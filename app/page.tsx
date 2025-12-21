
import React from 'react';
import newsData from '@/data/news.json';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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
    hype_score: number; // 1-10
}

function HypeMeter({ score }: { score: number }) {
    // Using Shadcn aesthetics: just a small indicator or color
    // Let's use a Badge color system based on score
    let colorClass = "bg-zinc-500";
    if (score >= 8) colorClass = "bg-red-500";
    else if (score >= 6) colorClass = "bg-orange-500";
    else if (score >= 4) colorClass = "bg-yellow-500";

    return (
        <Badge variant="outline" className={`${colorClass} text-white border-none`}>
            Hype: {score}/10
        </Badge>
    );
}

export default function Home() {
    const items = (newsData as NewsItem[]).sort((a, b) =>
        new Date(b.date_published || b.date_scraped).getTime() - new Date(a.date_published || a.date_scraped).getTime()
    );

    const lastUpdate = items.length > 0 ? new Date(items[0].date_scraped).toLocaleDateString() : 'Never';

    return (
        <main className="min-h-screen bg-background text-foreground font-sans p-4 md:p-8">
            <div className="mx-auto max-w-5xl space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">AI Research Radar</h1>
                        <p className="text-muted-foreground">Curated, AI-vetting research & engineering updates.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary">Last Sync: {lastUpdate}</Badge>
                        <a
                            href="https://github.com/your-repo"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                            GitHub
                        </a>
                    </div>
                </div>

                <Separator />

                {/* Filters (Visual Placeholder for now) */}
                <div className="flex gap-2 pb-2 overflow-x-auto">
                    <Button variant="secondary" size="sm">All</Button>
                    <Button variant="ghost" size="sm">Research (LLM)</Button>
                    <Button variant="ghost" size="sm">Engineering</Button>
                    <Button variant="ghost" size="sm">Academia</Button>
                </div>

                {/* Feed */}
                <div className="grid grid-cols-1 gap-4">
                    {items.length === 0 ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>No Data Found</CardTitle>
                                <CardDescription>Run the scraper to populate news.</CardDescription>
                            </CardHeader>
                        </Card>
                    ) : (
                        items.map(item => (
                            <Card key={item.id} className="hover:bg-muted/50 transition-colors">
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                                <span className="font-semibold text-primary">{item.source}</span>
                                                <span>•</span>
                                                <span>{new Date(item.date_published || item.date_scraped).toLocaleDateString()}</span>
                                            </div>
                                            <CardTitle className="text-xl leading-snug">
                                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline decoration-primary underline-offset-4">
                                                    {item.title}
                                                </a>
                                            </CardTitle>
                                        </div>
                                        <HypeMeter score={item.hype_score} />
                                    </div>
                                </CardHeader>
                                <CardContent className="pb-3">
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {item.tldr}
                                    </p>
                                </CardContent>
                                <CardFooter className="flex flex-wrap gap-2 pt-0">
                                    {item.tags.map(tag => (
                                        <Badge key={tag} variant="secondary" className="text-xs font-normal">
                                            #{tag}
                                        </Badge>
                                    ))}
                                </CardFooter>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </main>
    );
}