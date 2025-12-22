"use client";

import * as React from "react";
import { MagnifyingGlass, X, Flame, Lightning, Sparkle, FunnelSimple, SortAscending } from "@phosphor-icons/react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

type HypeRange = "low" | "medium" | "high";
type SortOption = "date-desc" | "date-asc" | "hype-desc" | "hype-asc";

interface NewsFeedProps {
    initialItems: NewsItem[];
}

// --- Helpers ---
function getHypeRange(score: number): HypeRange {
    if (score >= 7) return "high";
    if (score >= 4) return "medium";
    return "low";
}

function matchesSearch(item: NewsItem, query: string): boolean {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
        item.title.toLowerCase().includes(q) ||
        item.tldr.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
    );
}

// --- Subcomponents ---
function HypeMeter({ score }: { score: number }) {
    let colorClass = "bg-zinc-500/80";
    let Icon = Sparkle;
    if (score >= 7) {
        colorClass = "bg-gradient-to-r from-red-500 to-orange-500";
        Icon = Flame;
    } else if (score >= 4) {
        colorClass = "bg-gradient-to-r from-orange-500 to-yellow-500";
        Icon = Lightning;
    }

    return (
        <Badge variant="outline" className={`${colorClass} text-white border-none gap-1 font-semibold`}>
            <Icon className="h-3 w-3" weight="fill" />
            {score}/10
        </Badge>
    );
}

const HYPE_OPTIONS: { id: HypeRange; label: string; range: string; color: string }[] = [
    { id: "high", label: "High", range: "7-10", color: "data-[active=true]:bg-red-500/20 data-[active=true]:text-red-400 data-[active=true]:border-red-500/50" },
    { id: "medium", label: "Medium", range: "4-6", color: "data-[active=true]:bg-orange-500/20 data-[active=true]:text-orange-400 data-[active=true]:border-orange-500/50" },
    { id: "low", label: "Low", range: "1-3", color: "data-[active=true]:bg-zinc-500/20 data-[active=true]:text-zinc-400 data-[active=true]:border-zinc-500/50" },
];

// --- Main Component ---
export function NewsFeed({ initialItems }: NewsFeedProps) {
    const [search, setSearch] = React.useState("");
    const [activeHype, setActiveHype] = React.useState<HypeRange[]>([]);
    const [activeTags, setActiveTags] = React.useState<string[]>([]);
    const [activeSources, setActiveSources] = React.useState<string[]>([]);
    const [sortOption, setSortOption] = React.useState<SortOption>("date-desc");
    const [showFilters, setShowFilters] = React.useState(false);

    // Compute unique tags and sources
    const allTags = React.useMemo(() => {
        const tagCounts: Record<string, number> = {};
        initialItems.forEach((item) => item.tags.forEach((t) => (tagCounts[t] = (tagCounts[t] || 0) + 1)));
        return Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([tag]) => tag);
    }, [initialItems]);

    const allSources = React.useMemo(() => {
        const sourceCounts: Record<string, number> = {};
        initialItems.forEach((item) => (sourceCounts[item.source] = (sourceCounts[item.source] || 0) + 1));
        return Object.entries(sourceCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }));
    }, [initialItems]);

    // Filter and sort
    const filteredItems = React.useMemo(() => {
        let items = initialItems.filter((item) => {
            // Search
            if (!matchesSearch(item, search)) return false;
            // Hype
            if (activeHype.length > 0 && !activeHype.includes(getHypeRange(item.hype_score))) return false;
            // Tags (AND logic)
            if (activeTags.length > 0 && !activeTags.every((t) => item.tags.includes(t))) return false;
            // Sources
            if (activeSources.length > 0 && !activeSources.includes(item.source)) return false;
            return true;
        });

        // Sort
        items.sort((a, b) => {
            const dateA = new Date(a.date_published || a.date_scraped).getTime();
            const dateB = new Date(b.date_published || b.date_scraped).getTime();
            switch (sortOption) {
                case "date-desc": return dateB - dateA;
                case "date-asc": return dateA - dateB;
                case "hype-desc": return b.hype_score - a.hype_score;
                case "hype-asc": return a.hype_score - b.hype_score;
                default: return 0;
            }
        });

        return items;
    }, [initialItems, search, activeHype, activeTags, activeSources, sortOption]);

    const hasActiveFilters = activeHype.length > 0 || activeTags.length > 0 || activeSources.length > 0;

    const toggleHype = (range: HypeRange) => {
        setActiveHype((prev) => (prev.includes(range) ? prev.filter((r) => r !== range) : [...prev, range]));
    };

    const toggleTag = (tag: string) => {
        setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    };

    const toggleSource = (source: string) => {
        setActiveSources((prev) => (prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]));
    };

    const resetFilters = () => {
        setSearch("");
        setActiveHype([]);
        setActiveTags([]);
        setActiveSources([]);
        setSortOption("date-desc");
    };

    const lastUpdate = initialItems.length > 0 ? new Date(initialItems[0].date_scraped).toLocaleDateString() : "Never";

    return (
        <div className="min-h-screen bg-background text-foreground font-sans">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
                <div className="mx-auto max-w-6xl px-4 py-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                                AI Research Radar
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Curated, AI-vetted research & engineering updates
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">Last Sync: {lastUpdate}</Badge>
                            <Badge variant="outline" className="text-xs">{filteredItems.length} articles</Badge>
                        </div>
                    </div>
                </div>
            </header>

            {/* Search & Filters Bar */}
            <div className="sticky top-[73px] z-40 border-b border-border/30 bg-background/60 backdrop-blur-lg">
                <div className="mx-auto max-w-6xl px-4 py-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        {/* Search */}
                        <InputGroup className="flex-1 max-w-md">
                            <InputGroupAddon align="inline-start">
                                <MagnifyingGlass className="h-4 w-4" />
                            </InputGroupAddon>
                            <InputGroupInput
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search articles, tags, sources..."
                            />
                            {search && (
                                <InputGroupAddon align="inline-end">
                                    <InputGroupButton size="icon-xs" onClick={() => setSearch("")}>
                                        <X className="h-3 w-3" />
                                    </InputGroupButton>
                                </InputGroupAddon>
                            )}
                        </InputGroup>

                        {/* Sort */}
                        <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                            <SelectTrigger className="w-[160px]">
                                <SortAscending className="h-4 w-4 mr-2" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="date-desc">Newest First</SelectItem>
                                <SelectItem value="date-asc">Oldest First</SelectItem>
                                <SelectItem value="hype-desc">Hype: High→Low</SelectItem>
                                <SelectItem value="hype-asc">Hype: Low→High</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Filter Toggle */}
                        <Button
                            variant={showFilters ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setShowFilters(!showFilters)}
                            className="gap-2"
                        >
                            <FunnelSimple className="h-4 w-4" />
                            Filters
                            {hasActiveFilters && (
                                <Badge variant="default" className="h-5 w-5 p-0 justify-center text-xs">
                                    {activeHype.length + activeTags.length + activeSources.length}
                                </Badge>
                            )}
                        </Button>

                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
                                Reset
                            </Button>
                        )}
                    </div>

                    {/* Expanded Filters */}
                    {showFilters && (
                        <div className="mt-4 space-y-4 pb-2">
                            {/* Hype Score */}
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-muted-foreground w-20">Hype:</span>
                                {HYPE_OPTIONS.map((opt) => (
                                    <Button
                                        key={opt.id}
                                        variant="outline"
                                        size="sm"
                                        data-active={activeHype.includes(opt.id)}
                                        onClick={() => toggleHype(opt.id)}
                                        className={`gap-1 ${opt.color}`}
                                    >
                                        {opt.label}
                                        <span className="text-xs opacity-60">({opt.range})</span>
                                    </Button>
                                ))}
                            </div>

                            {/* Sources */}
                            <div className="flex flex-wrap items-start gap-2">
                                <span className="text-sm font-medium text-muted-foreground w-20 pt-1">Sources:</span>
                                <div className="flex flex-wrap gap-1.5 flex-1">
                                    {allSources.map((src) => (
                                        <Badge
                                            key={src.name}
                                            variant={activeSources.includes(src.name) ? "default" : "secondary"}
                                            className="cursor-pointer transition-all hover:opacity-80"
                                            onClick={() => toggleSource(src.name)}
                                        >
                                            {src.name} ({src.count})
                                            {activeSources.includes(src.name) && <X className="h-3 w-3 ml-1" />}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            {/* Active Tags */}
                            {activeTags.length > 0 && (
                                <div className="flex flex-wrap items-start gap-2">
                                    <span className="text-sm font-medium text-muted-foreground w-20 pt-1">Tags:</span>
                                    <div className="flex flex-wrap gap-1.5 flex-1">
                                        {activeTags.map((tag) => (
                                            <Badge
                                                key={tag}
                                                variant="default"
                                                className="cursor-pointer"
                                                onClick={() => toggleTag(tag)}
                                            >
                                                #{tag}
                                                <X className="h-3 w-3 ml-1" />
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <main className="mx-auto max-w-6xl px-4 py-6">
                <div className="grid grid-cols-1 gap-4">
                    {filteredItems.length === 0 ? (
                        <Card className="border-dashed">
                            <CardHeader className="text-center py-12">
                                <CardTitle className="text-muted-foreground">No articles found</CardTitle>
                                <p className="text-sm text-muted-foreground mt-2">
                                    {hasActiveFilters || search ? "Try adjusting your filters or search query" : "Run the scraper to populate news"}
                                </p>
                            </CardHeader>
                        </Card>
                    ) : (
                        filteredItems.map((item) => (
                            <Card
                                key={item.id}
                                className="group hover:bg-muted/30 hover:border-border transition-all duration-200"
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="space-y-1.5 flex-1 min-w-0">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Badge
                                                    variant="outline"
                                                    className="cursor-pointer hover:bg-muted"
                                                    onClick={() => {
                                                        if (!activeSources.includes(item.source)) toggleSource(item.source);
                                                    }}
                                                >
                                                    {item.source}
                                                </Badge>
                                                <span>•</span>
                                                <span>{new Date(item.date_published || item.date_scraped).toLocaleDateString()}</span>
                                            </div>
                                            <CardTitle className="text-lg leading-snug">
                                                <a
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hover:text-primary transition-colors"
                                                >
                                                    {item.title}
                                                </a>
                                            </CardTitle>
                                        </div>
                                        <HypeMeter score={item.hype_score} />
                                    </div>
                                </CardHeader>
                                <CardContent className="pb-3">
                                    <p className="text-sm text-muted-foreground leading-relaxed">{item.tldr}</p>
                                </CardContent>
                                <CardFooter className="flex flex-wrap gap-1.5 pt-0">
                                    {item.tags.map((tag) => (
                                        <Badge
                                            key={tag}
                                            variant="secondary"
                                            className="text-xs font-normal cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                            onClick={() => {
                                                if (!activeTags.includes(tag)) toggleTag(tag);
                                            }}
                                        >
                                            #{tag}
                                        </Badge>
                                    ))}
                                </CardFooter>
                            </Card>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
