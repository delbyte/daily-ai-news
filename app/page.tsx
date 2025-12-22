import newsData from '@/data/news.json';
import { NewsFeed } from "@/components/news-feed";

// --- Types ---
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

export default function Home() {
    const items = (newsData as NewsItem[]).sort((a, b) => b.hype_score - a.hype_score);

    return <NewsFeed initialItems={items} />;
}