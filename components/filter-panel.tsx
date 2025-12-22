"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { X, Flame, Zap, Sparkles, RotateCcw } from "lucide-react";

// --- Types ---
export type HypeRange = "low" | "medium" | "high";
export type SortOption = "date-desc" | "date-asc" | "hype-desc" | "hype-asc";

interface FilterPanelProps {
    // Hype
    activeHypeRanges: HypeRange[];
    onHypeChange: (ranges: HypeRange[]) => void;
    // Tags
    allTags: string[];
    activeTags: string[];
    onTagsChange: (tags: string[]) => void;
    // Sources
    allSources: { name: string; count: number }[];
    activeSources: string[];
    onSourcesChange: (sources: string[]) => void;
    // Sort
    sortOption: SortOption;
    onSortChange: (option: SortOption) => void;
    // Reset
    onReset: () => void;
    hasActiveFilters: boolean;
}

const HYPE_RANGES: { id: HypeRange; label: string; range: string; icon: React.ReactNode; color: string }[] = [
    { id: "high", label: "High", range: "7-10", icon: <Flame className="h-3 w-3" />, color: "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30" },
    { id: "medium", label: "Medium", range: "4-6", icon: <Zap className="h-3 w-3" />, color: "bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30" },
    { id: "low", label: "Low", range: "1-3", icon: <Sparkles className="h-3 w-3" />, color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/30" },
];

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
    { id: "date-desc", label: "Newest First" },
    { id: "date-asc", label: "Oldest First" },
    { id: "hype-desc", label: "Hype: High → Low" },
    { id: "hype-asc", label: "Hype: Low → High" },
];

export function FilterPanel({
    activeHypeRanges,
    onHypeChange,
    allTags,
    activeTags,
    onTagsChange,
    allSources,
    activeSources,
    onSourcesChange,
    sortOption,
    onSortChange,
    onReset,
    hasActiveFilters,
}: FilterPanelProps) {
    const toggleHype = (range: HypeRange) => {
        if (activeHypeRanges.includes(range)) {
            onHypeChange(activeHypeRanges.filter((r) => r !== range));
        } else {
            onHypeChange([...activeHypeRanges, range]);
        }
    };

    const toggleTag = (tag: string) => {
        if (activeTags.includes(tag)) {
            onTagsChange(activeTags.filter((t) => t !== tag));
        } else {
            onTagsChange([...activeTags, tag]);
        }
    };

    const toggleSource = (source: string) => {
        if (activeSources.includes(source)) {
            onSourcesChange(activeSources.filter((s) => s !== source));
        } else {
            onSourcesChange([...activeSources, source]);
        }
    };

    return (
        <div className="space-y-6">
            {/* Reset Button */}
            {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={onReset} className="w-full justify-start text-muted-foreground hover:text-foreground">
                    <RotateCcw className="h-3 w-3 mr-2" />
                    Reset All Filters
                </Button>
            )}

            {/* Sort */}
            <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Sort By</h3>
                <div className="flex flex-wrap gap-2">
                    {SORT_OPTIONS.map((option) => (
                        <Button
                            key={option.id}
                            variant={sortOption === option.id ? "secondary" : "ghost"}
                            size="xs"
                            onClick={() => onSortChange(option.id)}
                            className="text-xs"
                        >
                            {option.label}
                        </Button>
                    ))}
                </div>
            </div>

            <Separator className="bg-border/50" />

            {/* Hype Score */}
            <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Hype Score</h3>
                <div className="flex flex-wrap gap-2">
                    {HYPE_RANGES.map((range) => (
                        <Button
                            key={range.id}
                            variant="outline"
                            size="sm"
                            onClick={() => toggleHype(range.id)}
                            className={`gap-1.5 border ${activeHypeRanges.includes(range.id) ? range.color : "border-border/50 text-muted-foreground hover:text-foreground"}`}
                        >
                            {range.icon}
                            {range.label}
                            <span className="text-xs opacity-60">({range.range})</span>
                        </Button>
                    ))}
                </div>
            </div>

            <Separator className="bg-border/50" />

            {/* Sources */}
            <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Sources</h3>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2">
                    {allSources.map((source) => (
                        <Badge
                            key={source.name}
                            variant={activeSources.includes(source.name) ? "default" : "secondary"}
                            className={`cursor-pointer transition-all ${activeSources.includes(source.name) ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                            onClick={() => toggleSource(source.name)}
                        >
                            {source.name}
                            <span className="ml-1 opacity-60">({source.count})</span>
                            {activeSources.includes(source.name) && <X className="h-3 w-3 ml-1" />}
                        </Badge>
                    ))}
                </div>
            </div>

            <Separator className="bg-border/50" />

            {/* Tags */}
            <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Tags</h3>
                <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto pr-2">
                    {allTags.slice(0, 30).map((tag) => (
                        <Badge
                            key={tag}
                            variant={activeTags.includes(tag) ? "default" : "outline"}
                            className={`cursor-pointer text-xs transition-all ${activeTags.includes(tag) ? "bg-primary text-primary-foreground" : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"}`}
                            onClick={() => toggleTag(tag)}
                        >
                            #{tag}
                            {activeTags.includes(tag) && <X className="h-2.5 w-2.5 ml-1" />}
                        </Badge>
                    ))}
                    {allTags.length > 30 && (
                        <span className="text-xs text-muted-foreground">+{allTags.length - 30} more</span>
                    )}
                </div>
            </div>
        </div>
    );
}
