
import React from 'react';
import newsData from '@/data/news.json';

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

// --- Components ---

function HypeMeter({ score }: { score: number }) {
  const bars = 10;
  return (
    <div className="flex gap-0.5" title={`Hype Score: ${score}/10`}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`h-2 w-1 ${i < score
              ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]'
              : 'bg-zinc-800'
            }`}
        />
      ))}
    </div>
  );
}

function TerminalCard({ item }: { item: NewsItem }) {
  // Format info nicely
  const date = new Date(item.date_published || item.date_scraped).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric'
  });

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block border-l-2 border-zinc-800 bg-zinc-900/30 p-4 transition-all hover:border-green-500 hover:bg-zinc-900/60"
    >
      <div className="mb-2 flex items-center justify-between text-xs font-mono text-zinc-500 uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <span className="text-green-500">[{item.source}]</span>
          <span>{date}</span>
        </div>
        <HypeMeter score={item.hype_score} />
      </div>

      <h2 className="mb-2 font-mono text-lg font-bold text-zinc-100 group-hover:text-green-400 group-hover:underline decoration-green-500/30 underline-offset-4">
        {item.title}
      </h2>

      <p className="mb-3 text-sm text-zinc-400 leading-relaxed font-sans border-l-2 border-zinc-700 pl-3">
        {item.tldr}
      </p>

      <div className="flex gap-2 flex-wrap">
        {item.tags.map(tag => (
          <span key={tag} className="px-1.5 py-0.5 text-[10px] font-mono border border-zinc-700 text-zinc-400 bg-zinc-950">
            #{tag.toUpperCase()}
          </span>
        ))}
      </div>
    </a>
  );
}

export default function Home() {
  // Sort by date (already sorted in script, but ensuring here)
  const items = (newsData as NewsItem[]).filter(i => i.is_technical).slice(0, 50);

  const lastUpdate = items.length > 0 ? new Date(items[0].date_scraped).toLocaleString() : 'Never';

  return (
    <main className="min-h-screen bg-black text-zinc-100 font-mono selection:bg-green-900 selection:text-white pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/80 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">
              AI_RESEARCH_RADAR
            </h1>
            <p className="text-xs text-zinc-500">
              SYSTEM_STATUS: <span className="text-green-500">ONLINE</span> | LAST_SYNC: {lastUpdate}
            </p>
          </div>
          <div className="hidden sm:block text-right">
            <div className="text-[10px] text-zinc-600">
              MONITORING: {items.length} SOURCES
            </div>
            <div className="text-[10px] text-zinc-600">
              NEXT_SCAN: T-04:00:00
            </div>
          </div>
        </div>
      </header>

      {/* Feed */}
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
        {items.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-zinc-800 text-zinc-600">
            NO_DATA_FOUND. Initialize scripts/scrape.ts to populate.
          </div>
        ) : (
          items.map(item => (
            <TerminalCard key={item.id} item={item} />
          ))
        )}
      </div>

      {/* Footer */}
      <footer className="fixed bottom-4 right-4 text-[10px] text-zinc-700 mix-blend-difference pointer-events-none">
        V1.0.0 | GEN_AI_POWERED
      </footer>
    </main>
  );
}
