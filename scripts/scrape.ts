import 'dotenv/config'; // Load .env
import puppeteer from 'puppeteer';
import Parser from 'rss-parser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// --- Configuration ---
const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_KEY;
const DATA_FILE = path.join(process.cwd(), 'data', 'news.json');

// Strict Age Limit: 7 days
const AGE_LIMIT_DAYS = 7;
const AGE_LIMIT_MS = AGE_LIMIT_DAYS * 24 * 60 * 60 * 1000;

type SourceType = 'rss' | 'puppeteer';

interface Source {
    name: string;
    url: string;
    type: SourceType;
    selector?: string; // For Puppeteer
    urlPattern?: RegExp; // URL must match this pattern to be included
}

interface NewsItem {
    id: string;
    source: string;
    title: string;
    url: string;
    date_scraped: string;
    date_published?: string;
    is_technical: boolean;
    tldr: string;
    tags: string[];
    hype_score: number;
}

const SOURCES: Source[] = [
    // --- Tier 1: Foundation Models ---
    { name: 'OpenAI', url: 'https://openai.com/news/rss.xml', type: 'rss' },
    { name: 'Anthropic News', url: 'https://www.anthropic.com/news', type: 'puppeteer', selector: 'a[href*="/news/"]', urlPattern: /\/news\/[a-z0-9-]+$/i },
    { name: 'Anthropic Research', url: 'https://www.anthropic.com/research', type: 'puppeteer', selector: 'a[href*="/research/"]', urlPattern: /\/research\/[a-z0-9-]+$/i },
    { name: 'Claude Blog', url: 'https://claude.com/blog', type: 'puppeteer', selector: '.clickable_link[href*="/blog/"]', urlPattern: /claude\.com\/blog\/[a-z0-9-]+$/i },
    { name: 'DeepMind', url: 'https://deepmind.google/blog/rss.xml', type: 'rss' },
    { name: 'xAI', url: 'https://x.ai/blog', type: 'puppeteer', selector: 'a[href*="/blog/"]', urlPattern: /x\.ai\/blog\/[a-z0-9-]+$/i },
    { name: 'Meta AI', url: 'https://engineering.fb.com/feed/', type: 'rss' },
    { name: 'Google Research', url: 'https://blog.research.google/feeds/posts/default?alt=rss', type: 'rss' },
    { name: 'Microsoft Research', url: 'https://www.microsoft.com/en-us/research/feed/', type: 'rss' },

    // --- Tier 2: Engineering & Community ---
    { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', type: 'rss' },
    { name: 'AWS ML', url: 'https://aws.amazon.com/blogs/machine-learning/feed/', type: 'rss' },
    { name: 'LangChain', url: 'https://blog.langchain.dev/rss/', type: 'rss' },
    { name: 'NVIDIA Blog', url: 'https://developer.nvidia.com/blog/feed', type: 'rss' },

    // --- Tier 3: Academia ---
    { name: 'Stanford SAIL', url: 'https://ai.stanford.edu/blog/feed.xml', type: 'rss' },
    { name: 'Berkeley BAIR', url: 'https://bair.berkeley.edu/blog/feed.xml', type: 'rss' },
];

// --- Helpers ---

function generateId(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex');
}

function isRecent(dateStr?: string): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return diff < AGE_LIMIT_MS;
}

// Extract date from text using regex for common formats like "Oct 15, 2025" or ISO
function extractDate(text: string): string | undefined {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthRegex = new RegExp(`(${months.join('|')})\\s+\\d{1,2},?\\s+\\d{4}`, 'i');
    const match = text.match(monthRegex);
    if (match) return new Date(match[0]).toISOString();

    // ISO-like check
    const isoMatch = text.match(/\d{4}-\d{2}-\d{2}/);
    if (isoMatch) return new Date(isoMatch[0]).toISOString();

    return undefined;
}

async function scrapeRSS(source: Source): Promise<Partial<NewsItem>[]> {
    const parser = new Parser();
    try {
        const feed = await parser.parseURL(source.url);
        return feed.items.map(item => ({
            source: source.name,
            title: item.title || 'No Title',
            url: item.link || '',
            date_published: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
        }))
            .filter(i => isRecent(i.date_published)); // Pre-filter logic if date exists
    } catch (e) {
        console.error(`[RSS] Failed to parse ${source.name}:`, e);
        return [];
    }
}

async function scrapePuppeteer(source: Source): Promise<Partial<NewsItem>[]> {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Generic extraction logic
        const selector = source.selector || 'a';
        const links = await page.evaluate((sel: string) => {
            const anchors = Array.from(document.querySelectorAll(sel));
            return anchors.map(anchor => {
                const a = anchor as HTMLAnchorElement;
                // Check data-cta-copy first (used by Webflow CMS like claude.com/blog)
                const title = a.getAttribute('data-cta-copy') || a.innerText.trim() || a.getAttribute('aria-label') || '';
                // Try to find a date near the anchor (parent/sibling text)
                // This is rudimentary. Ideally we parse specific DOMs per site.
                let contextText = "";
                let parent = a.parentElement;
                if (parent) {
                    contextText += parent.innerText;
                    if (parent.parentElement) contextText += " " + parent.parentElement.innerText;
                }

                return {
                    title: title,
                    url: a.href,
                    context: contextText // Send context to Node for date extraction
                };
            })
                .filter(item => {
                    // Filter out junk: short titles, non-article links
                    if (item.title.length < 20) return false;
                    if (!item.url.startsWith('http')) return false;

                    // Exclude common junk patterns
                    const junkPatterns = [
                        /terms\s*of\s*service/i,
                        /privacy\s*policy/i,
                        /cookie\s*policy/i,
                        /responsible\s*disclosure/i,
                        /security\s*and\s*compliance/i,
                        /visit\s*our\s*(linkedin|twitter|youtube|x\s*\(|facebook)/i,
                        /follow\s*us/i,
                        /careers\s*at/i,
                        /join\s*our\s*team/i,
                        /contact\s*us/i,
                        /about\s*us$/i,
                        /sign\s*up/i,
                        /log\s*in/i,
                        /subscribe/i,
                        /newsletter/i,
                    ];

                    for (const pattern of junkPatterns) {
                        if (pattern.test(item.title)) return false;
                    }

                    // Exclude social media and non-article URLs
                    const junkUrls = [
                        /linkedin\.com/i,
                        /twitter\.com/i,
                        /x\.com(?!\.ai)/i, // x.com but not x.ai
                        /youtube\.com/i,
                        /facebook\.com/i,
                        /instagram\.com/i,
                        /\/careers/i,
                        /\/jobs/i,
                        /\/legal/i,
                        /\/terms/i,
                        /\/privacy/i,
                    ];

                    for (const pattern of junkUrls) {
                        if (pattern.test(item.url)) return false;
                    }

                    return true;
                });
        }, selector);

        await browser.close();

        const uniqueLinks = new Map();
        links.forEach(l => {
            if (!uniqueLinks.has(l.url)) {
                const extractedDate = extractDate(l.context || "");
                uniqueLinks.set(l.url, {
                    source: source.name,
                    title: l.title,
                    url: l.url,
                    date_published: extractedDate // May be undefined
                });
            }
        });

        // For puppeteer, if date is missing, we MIGHT skip, or we send to AI to verify?
        // User wants strict 1 week. If we can't find a date, it's risky.
        // However, AI can also extract date from content if we wanted to fetch it.
        // For now, let's keep items without dates but mark them for AI to check "Recentness".
        return Array.from(uniqueLinks.values());

    } catch (e) {
        console.error(`[Puppeteer] Failed to scrape ${source.name}:`, e);
        if (browser) await browser.close();
        return [];
    }
}

async function enhanceWithAI(items: Partial<NewsItem>[]): Promise<NewsItem[]> {
    if (!GEMINI_API_KEY) {
        console.warn("Skipping AI enhancement: No GEMINI_API_KEY found.");
        // Fallback: Only keep if we KNOW it's recent
        return items.filter(i => isRecent(i.date_published)).map(i => ({
            ...i,
            id: generateId(i.url!),
            date_scraped: new Date().toISOString(),
            is_technical: true,
            tldr: "No AI summary available.",
            tags: ["Unclassified"],
            hype_score: 5
        } as NewsItem));
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Prompt Logic: strict verification
    const prompt = `
  You are the Editor-in-Chief of a high-tech AI research newsletter.
  
  CONTEXT:
  - Today's Date: ${today}
  - Strict Requirement: News must be from the **LAST 7 DAYS**.
  - Strict Requirement: Content must be **TECHNICAL** (Research papers, Engineering Blogs, Major Model Releases).
  - IGNORE: Hiring posts, Policy/Regulation (unless major technical impact), Marketing fluff, Tutorials, "How to use X".
  
  INPUT:
  ${JSON.stringify(items.map(i => ({
        title: i.title,
        url: i.url,
        source: i.source,
        date_published_guess: i.date_published
    })))}

  TASK:
  1. For each item, decide if it passes the filters (Technical + recent).
  2. If 'date_published_guess' is missing or old, try to infer from the title (e.g. "Introducing GPT-5" is likely new, "GPT-3 Released" is old). Use your knowledge cutoff effectively but prioritize the "Last 7 Days" rule based on the current date provided.
  3. If accepted:
     - Generate a 'tldr' (Technical, dense, 2 sentences).
     - Assign 'tags' (e.g. transformer, rl, vision, infrastructure).
     - Rate 'hype_score' (1-10) - 10 being breakthrough.
  
  OUTPUT:
  Return a JSON Object with a property "items" containing ONLY the accepted items.
  Shape:
  {
      "items": [
          {
              "url": "string match",
              "tldr": "string",
              "tags": ["string"],
              "hype_score": number,
              "date_published": "ISOString" (If you can refine the date, otherwise use the input date or today if newly released)
          }
      ]
  }
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const aiData = JSON.parse(text);

        // Merge AI data back
        const finalItems: NewsItem[] = [];

        if (aiData.items && Array.isArray(aiData.items)) {
            for (const aiItem of aiData.items) {
                const original = items.find(i => i.url === aiItem.url);
                if (original) {
                    finalItems.push({
                        id: generateId(original.url!),
                        source: original.source!,
                        title: original.title!,
                        url: original.url!,
                        date_scraped: new Date().toISOString(),
                        date_published: aiItem.date_published || original.date_published,
                        is_technical: true,
                        tldr: aiItem.tldr,
                        tags: aiItem.tags,
                        hype_score: aiItem.hype_score
                    });
                }
            }
        }

        return finalItems;

    } catch (e) {
        console.error("AI Processing Failed (Batch):", e);
        // Fallback: Keep items but mark as unverified
        return items.map(i => ({
            ...i,
            id: generateId(i.url!),
            date_scraped: new Date().toISOString(),
            is_technical: true,
            tldr: "AI Vetting Failed. Raw content.",
            tags: ["Unverified"],
            hype_score: 1
        } as NewsItem));
    }
}

// --- Main ---

async function main() {
    console.log("Starting Scrape Job (Full Re-vet Mode)...");

    // Fresh start each run - no loading existing data
    // This ensures all items are re-vetted and strictly filtered

    const candidates: Partial<NewsItem>[] = [];
    const seenUrls = new Set<string>();

    // 1. Scrape all sources
    for (const source of SOURCES) {
        console.log(`Scraping ${source.name} (${source.type})...`);
        let items: Partial<NewsItem>[] = [];
        if (source.type === 'rss') {
            items = await scrapeRSS(source);
        } else {
            items = await scrapePuppeteer(source);
        }

        // Add to candidates (dedupe by URL)
        for (const item of items) {
            if (item.url && !seenUrls.has(item.url)) {
                seenUrls.add(item.url);
                candidates.push(item);
            }
        }
    }

    console.log(`Found ${candidates.length} total candidates to vet.`);

    if (candidates.length === 0) {
        console.log("No candidates found.");
        await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2));
        return;
    }

    // 3. Process with AI
    // Batch processing
    const BATCH_SIZE = 40;
    const newVerifiedItems: NewsItem[] = [];

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
        const batch = candidates.slice(i, i + BATCH_SIZE);
        console.log(`Processing AI batch ${i / BATCH_SIZE + 1}...`);
        const verified = await enhanceWithAI(batch);
        newVerifiedItems.push(...verified);
    }

    console.log(`AI Vetting complete. Accepted ${newVerifiedItems.length} new items.`);

    // 2. Trust AI's recency judgment - it was instructed to only accept items from the last 7 days
    const finalData = newVerifiedItems
        .sort((a, b) =>
            new Date(b.date_published || b.date_scraped).getTime() - new Date(a.date_published || a.date_scraped).getTime()
        );

    await fs.writeFile(DATA_FILE, JSON.stringify(finalData, null, 2));
    console.log(`Saved DB. Total verified recent items: ${finalData.length}`);
}

main().catch(console.error);
