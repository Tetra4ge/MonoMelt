interface AnalysisMetricsProps {
  metrics: {
    total_files?: number;
    total_loc?: number;
    total_lines?: number;
    total_classes?: number;
    total_functions?: number;
    languages?: Record<string, number>;
    language_breakdown?: Record<string, number>;
  };
}

export default function AnalysisMetrics({ metrics }: AnalysisMetricsProps) {
  if (!metrics) return null;

  const loc = metrics.total_loc ?? metrics.total_lines ?? 0;
  const languages = metrics.languages ?? metrics.language_breakdown ?? {};

  const cards = [
    { label: "Total Source Files", value: (metrics.total_files || 0).toLocaleString(), accent: "text-[#B8FF45]" },
    { label: "Lines of Code", value: loc.toLocaleString(), accent: "text-[#3B82F6]" },
    { label: "Total Classes", value: (metrics.total_classes || 0).toLocaleString(), accent: "text-[#FFA62B]" },
    { label: "Total Functions", value: (metrics.total_functions || 0).toLocaleString(), accent: "text-[#FF5BB5]" },
  ];

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {cards.map((card, i) => (
          <div key={i} className="neo-card p-6 flex flex-col justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#808080]">
              {card.label}
            </span>
            <span className={`text-3xl font-extrabold mt-2 font-inter ${card.accent}`}>
              {card.value}
            </span>
          </div>
        ))}
      </div>

      {/* Language Breakdown Bar */}
      <div className="neo-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <span className="font-bebas text-lg text-[#BEBEBE] tracking-wide">
          PARSED LANGUAGES:
        </span>
        <div className="flex flex-wrap gap-2">
          {Object.entries(languages).map(([lang, count]) => (
            <div key={lang} className="px-4 py-2 bg-[#181818] rounded-full text-xs font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#B8FF45]"></span>
              <span className="font-bold text-white">{lang}</span>
              <span className="text-[#808080]">({count} files)</span>
            </div>
          ))}
          {Object.keys(languages).length === 0 && (
            <span className="text-[#808080] text-xs italic">No languages detected</span>
          )}
        </div>
      </div>
    </div>
  );
}
