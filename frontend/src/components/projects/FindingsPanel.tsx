import { Sparkles, Check, X } from 'lucide-react';

interface Finding {
  id: string;
  finding_type: string;
  explanation: string;
  confidence: number;
  subject_ids: string[];
  evidence_ids: string[];
  review_status: string;
  needs_review: boolean;
}

interface FindingsPanelProps {
  findings: Finding[];
  onReview: (findingId: string, status: string) => void;
}

export default function FindingsPanel({ findings, onReview }: FindingsPanelProps) {
  if (!findings || findings.length === 0) return null;

  const getTypeStyle = (type: string) => {
    switch (type.toLowerCase()) {
      case 'domain': 
        return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
      case 'risk': 
        return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
      case 'sensitivity': 
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      default: 
        return 'bg-lime-500/10 text-lime-300 border-lime-500/30';
    }
  };

  return (
    <div className="bg-[#141417] border border-[#232328] rounded-3xl p-6 mb-6 shadow-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-[#222228] pb-4">
        <h2 className="text-xl font-black font-syne text-white flex items-center gap-2 uppercase tracking-tight">
          <Sparkles className="w-5 h-5 text-lime-400" />
          AI ARCHITECTURAL FINDINGS
        </h2>
        <span className="text-xs font-mono text-zinc-400">
          Total: {findings.length} Items
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {findings.map((finding) => (
          <div key={finding.id} className="bg-[#0b0b0e] border border-[#232328] rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-all">
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${getTypeStyle(finding.finding_type)}`}>
                  {finding.finding_type}
                </span>
                <span className="text-zinc-500 text-xs font-mono">
                  {(finding.confidence * 100).toFixed(0)}% Conf
                </span>
              </div>
              
              <p className="text-zinc-300 text-xs leading-relaxed mb-4">
                {finding.explanation}
              </p>
              
              {finding.subject_ids && finding.subject_ids.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Impacted Nodes</p>
                  <div className="flex flex-wrap gap-1">
                    {finding.subject_ids.map((id, idx) => (
                      <span key={idx} className="text-[10px] font-mono text-zinc-400 bg-[#16161c] px-2 py-0.5 rounded border border-[#232328]">
                        {typeof id === 'string' ? id.substring(0, 10) : id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#1e1e24] flex items-center justify-between">
              {finding.review_status === 'pending' ? (
                <div className="flex gap-2 w-full font-mono">
                  <button 
                    onClick={() => onReview(finding.id, 'approved')}
                    className="flex-1 py-1.5 bg-lime-500/10 text-lime-300 border border-lime-500/30 hover:bg-lime-500 hover:text-black rounded-lg transition-all text-xs font-bold uppercase flex items-center justify-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button 
                    onClick={() => onReview(finding.id, 'rejected')}
                    className="flex-1 py-1.5 bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500 hover:text-white rounded-lg transition-all text-xs font-bold uppercase flex items-center justify-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              ) : (
                <div className="w-full text-center">
                  <span className={`text-xs font-bold uppercase tracking-wider font-mono ${finding.review_status === 'approved' ? 'text-lime-400' : 'text-rose-400'}`}>
                    Status: {finding.review_status}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
