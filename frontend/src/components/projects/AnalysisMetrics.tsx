interface AnalysisMetricsProps {
  metrics: {
    total_files: number;
    total_loc: number;
    total_classes: number;
    total_functions: number;
    languages: Record<string, number>;
  };
}

export default function AnalysisMetrics({ metrics }: AnalysisMetricsProps) {
  if (!metrics) return null;

  const cards = [
    { label: "Total Source Files", value: metrics.total_files, accent: "border-lime-500/30 text-lime-300" },
    { label: "Lines of Code", value: metrics.total_loc.toLocaleString(), accent: "border-indigo-500/30 text-indigo-300" },
    { label: "Total Classes", value: metrics.total_classes, accent: "border-orange-500/30 text-orange-300" },
    { label: "Total Functions", value: metrics.total_functions, accent: "border-purple-500/30 text-purple-300" },
  ];

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {cards.map((card, i) => (
          <div key={i} className="bg-[#141417] border border-[#232328] rounded-3xl p-5 flex flex-col justify-between shadow-xl">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 font-mono">
              {card.label}
            </span>
            <span className="text-3xl font-black font-syne text-white mt-2 tracking-tight">
              {card.value}
            </span>
          </div>
        ))}
      </div>

      {/* Language Breakdown Bar */}
      <div className="bg-[#141417] border border-[#232328] rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <span className="text-xs font-black font-syne uppercase tracking-wider text-zinc-400">
          PARSED LANGUAGES:
        </span>
        <div className="flex flex-wrap gap-2">
          {Object.entries(metrics.languages || {}).map(([lang, count]) => (
            <div key={lang} className="px-3.5 py-1.5 bg-[#0b0b0e] border border-[#232328] rounded-full text-xs font-mono flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-lime-400"></span>
              <span className="font-bold text-zinc-200">{lang}</span>
              <span className="text-zinc-500">({count} files)</span>
            </div>
          ))}
          {Object.keys(metrics.languages || {}).length === 0 && (
            <span className="text-zinc-500 text-xs italic font-mono">No languages detected</span>
          )}
        </div>
      </div>
    </div>
  );
}
