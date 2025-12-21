
import puppeteer from 'puppeteer';
import Parser from 'rss-parser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// --- Configuration ---
const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_KEY;
const DATA_FILE = path.join(process.cwd(), 'data', 'news.json');

type SourceType = 'rss' | 'puppeteer';

interface Source {
    name: string;
    url: string;
    type: SourceType;
    selector?: string; // For Puppeteer: container to search in
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
    { name: 'OpenAI', url: 'https://openai.com/news/', type: 'puppeteer', selector: 'a[href^="/news/"]' }, // OpenAI updated their site, often has /news/ or /index/
    { name: 'Anthropic', url: 'https://www.anthropic.com/news', type: 'puppeteer', selector: 'a[href^="/news/"]' },
    { name: 'DeepMind', url: 'https://deepmind.google/discover/blog/rss.xml', type: 'rss' }, // Trying RSS first as fallback
    { name: 'xAI', url: 'https://x.ai/blog', type: 'puppeteer', selector: 'a' },
    { name: 'Meta AI', url: 'https://ai.meta.com/blog/', type: 'puppeteer', selector: 'a' },
    { name: 'Google Research', url: 'https://blog.research.google/feeds/posts/default?alt=rss', type: 'rss' },

    // --- Tier 2: Engineering ---
    { name: 'NVIDIA Blog', url: 'https://developer.nvidia.com/blog/feed', type: 'rss' }, // Found feed
    { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', type: 'rss' },
    { name: 'AWS ML', url: 'https://aws.amazon.com/blogs/machine-learning/feed/', type: 'rss' },
    { name: 'Microsoft Research', url: 'https://www.microsoft.com/en-us/research/blog/feed/', type: 'rss' },
    { name: 'LangChain', url: 'https://blog.langchain.dev/rss/', type: 'rss' },

    // --- Tier 3: Academia (Limited) ---
    { name: 'Stanford SAIL', url: 'https://ai.stanford.edu/blog/feed.xml', type: 'rss' },
    { name: 'Berkeley BAIR', url: 'https://bair.berkeley.edu/blog/feed.xml', type: 'rss' },
];

// --- Helpers ---

function generateId(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex');
}

async function scrapeRSS(source: Source): Promise<Partial<NewsItem>[]> {
    const parser = new Parser();
    try {
        const feed = await parser.parseURL(source.url);
        return feed.items.map(item => ({
            source: source.name,
            title: item.title || 'No Title',
            url: item.link || '',
            date_published: item.pubDate,
        })).slice(0, 5); // Limit to top 5
    } catch (e) {
        console.error(`[RSS] Failed to parse ${source.name}:`, e);
        return [];
    }
}

async function scrapePuppeteer(source: Source): Promise<Partial<NewsItem>[]> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Anti-bot
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Generic extraction logic - customize based on site structures if needed
        // This looks for <a> tags that likely contain titles and links.
        const selector = source.selector || 'a';
        const links = await page.evaluate((sel: string) => {
            const anchors = Array.from(document.querySelectorAll(sel));
            return anchors.map(anchor => {
                const a = anchor as HTMLAnchorElement;
                // Basic heuristic to find headline text inside the anchor or its children
                const title = a.innerText.trim() || a.getAttribute('aria-label') || '';
                return {
                    title: title,
                    url: a.href,
                };
            })
                .filter(item => item.title.length > 20 && item.url.startsWith('http')); // Filter noise
        }, selector);

        await browser.close();

        // Dedupe within the scrape
        const uniqueLinks = new Map();
        links.forEach(l => uniqueLinks.set(l.url, l));

        // Return top 5 most likely "article" looking links
        return Array.from(uniqueLinks.values()).slice(0, 5).map(l => ({
            source: source.name,
            title: l.title,
            url: l.url,
            date_published: new Date().toISOString() // Fallback
        }));

    } catch (e) {
        console.error(`[Puppeteer] Failed to scrape ${source.name}:`, e);
        await browser.close();
        return [];
    }
}

async function enhanceWithAI(items: Partial<NewsItem>[]): Promise<NewsItem[]> {
    if (!GEMINI_API_KEY) {
        console.warn("Skipping AI enhancement: No GEMINI_API_KEY found.");
        return items.map(i => ({
            ...i,
            id: generateId(i.url!),
            date_scraped: new Date().toISOString(),
            is_technical: true, // Default to keep everything if no AI
            tldr: "No AI summary available.",
            tags: ["Unclassified"],
            hype_score: 5
        } as NewsItem));
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const prompt = `
  You are an expert AI Researcher and Engineering Editor.
  TODAY'S DATE: ${today}.
  
  Analyze the following list of potential AI news items.
  
  Task:
  1. Filter out non-technical content (careers, marketing fluff, generic announcements, policy updates). keep ONLY research papers, engineering blogs, release notes, and significant product launches.
  2. For each technical item, provide a 2-sentence technical TL;DR summarizing the core innovation or release.
  3. Assign tags (e.g., LLM, Vision, Infrastructure, RL).
  4. Rate "Hype Score" (1-10) based on actual technical significance versus marketing buzz.
  
  Input Data:
  ${JSON.stringify(items.map(i => ({ title: i.title, url: i.url, source: i.source, date: i.date_published })))}

  Return a valid JSON array of objects with these fields ONLY:
  - url: (string) matching input
  - is_technical: (boolean)
  - tldr: (string)
  - tags: (string[])
  - hype_score: (number)
  
  Return strictly valid JSON. No markdown formatting.
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const aiData = JSON.parse(text);

        // Merge AI data back
        const finalItems: NewsItem[] = [];

        for (const item of items) {
            const aiInfo = aiData.find((a: any) => a.url === item.url);
            if (aiInfo) {
                finalItems.push({
                    ...item,
                    id: generateId(item.url!),
                    date_scraped: new Date().toISOString(),
                    is_technical: aiInfo.is_technical,
                    tldr: aiInfo.tldr,
                    tags: aiInfo.tags,
                    hype_score: aiInfo.hype_score
                } as NewsItem);
            }
        }

        return finalItems.filter(i => i.is_technical);

    } catch (e) {
        console.error("AI Processing Failed:", e);
        return [];
    }
}

// --- Main ---

async function main() {
    console.log("Starting Scrape Job...");

    // 1. Load existing data
    let existingData: NewsItem[] = [];
    try {
        const raw = await fs.readFile(DATA_FILE, 'utf-8');
        existingData = JSON.parse(raw);
    } catch (e) {
        console.log("No existing data found, starting fresh.");
    }

    const existingUrls = new Set(existingData.map(i => i.url));
    let newCandidates: Partial<NewsItem>[] = [];

    // 2. Scrape all sources
    for (const source of SOURCES) {
        console.log(`Scraping ${source.name} (${source.type})...`);
        let items: Partial<NewsItem>[] = [];
        if (source.type === 'rss') {
            items = await scrapeRSS(source);
        } else {
            items = await scrapePuppeteer(source);
        }

        // Dedupe against local DB
        for (const item of items) {
            if (item.url && !existingUrls.has(item.url)) {
                newCandidates.push(item);
                existingUrls.add(item.url); // prevent duplicates within runs too
            }
        }
    }

    console.log(`Found ${newCandidates.length} new candidates.`);

    if (newCandidates.length === 0) {
        console.log("No new items found.");
        return;
    }

    // 3. Process with AI (in batches if needed, doing all at once for simplicity for now)
    // Limit to 20 items per run to save tokens/time if it's a huge initial run
    const batch = newCandidates.slice(0, 20);
    const processedItems = await enhanceWithAI(batch);

    // 4. Update Database
    const updatedData = [...processedItems, ...existingData].sort((a, b) =>
        new Date(b.date_scraped).getTime() - new Date(a.date_scraped).getTime()
    );

    // Keep max 100 items to keep repo light
    const trimmedData = updatedData.slice(0, 100);

    await fs.writeFile(DATA_FILE, JSON.stringify(trimmedData, null, 2));
    console.log(`Saved ${processedItems.length} new items. Total: ${trimmedData.length}`);
}

main().catch(console.error);

