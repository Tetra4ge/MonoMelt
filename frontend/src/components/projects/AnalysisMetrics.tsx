interface AnalysisMetricsProps {
  metrics: {
    total_files: number;
    total_lines: number;
    total_classes: number;
    total_functions: number;
    languages: Record<string, number>;
  };
}

export default function AnalysisMetrics({ metrics }: AnalysisMetricsProps) {
  if (!metrics) return null;

  const cards = [
    { label: "Total Files", value: metrics.total_files },
    { label: "Lines of Code", value: (metrics.total_lines || 0).toLocaleString() },
    { label: "Total Classes", value: metrics.total_classes },
    { label: "Total Functions", value: metrics.total_functions },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full mb-6">
      {cards.map((card, i) => (
        <div key={i} className="bg-[#111] border border-[#222] rounded-none p-4 flex flex-col justify-center">
          <span className="text-gray-500 text-xs font-mono uppercase tracking-widest">{card.label}</span>
          <span className="text-white text-3xl font-bold font-mono mt-1">{card.value}</span>
        </div>
      ))}
      
      <div className="bg-[#111] border border-[#222] rounded-none p-4 col-span-1 sm:col-span-2 lg:col-span-4 flex flex-col justify-center">
        <span className="text-gray-500 text-xs font-mono uppercase tracking-widest mb-2">Detected Languages</span>
        <div className="flex flex-wrap gap-3">
          {Object.entries(metrics.languages || {}).map(([lang, count]) => (
            <div key={lang} className="px-3 py-1 bg-black border border-[#333] text-gray-300 text-sm font-mono flex gap-2 items-center">
              <span>{lang}</span>
              <span className="text-gray-500">[{count}]</span>
            </div>
          ))}
          {Object.keys(metrics.languages || {}).length === 0 && (
            <span className="text-gray-600 text-sm italic font-mono">No languages detected</span>
          )}
        </div>
      </div>
    </div>
  );
}
