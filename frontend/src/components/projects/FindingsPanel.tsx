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

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'domain': return 'text-purple-400 border-purple-900 bg-purple-950/30';
      case 'risk': return 'text-red-400 border-red-900 bg-red-950/30';
      case 'sensitivity': return 'text-amber-400 border-amber-900 bg-amber-950/30';
      default: return 'text-blue-400 border-blue-900 bg-blue-950/30';
    }
  };

  return (
    <div className="w-full mb-6">
      <h2 className="text-xl font-bold mb-4 font-mono">AI Intelligence Findings</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {findings.map((finding) => (
          <div key={finding.id} className="bg-[#111] border border-[#333] p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider border ${getTypeColor(finding.finding_type)}`}>
                  {finding.finding_type}
                </span>
                <span className="text-gray-500 text-xs font-mono">
                  {(finding.confidence * 100).toFixed(0)}% Conf
                </span>
              </div>
              
              <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                {finding.explanation}
              </p>
              
              {finding.subject_ids && finding.subject_ids.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Impacted Nodes</p>
                  <div className="flex flex-wrap gap-1">
                    {finding.subject_ids.map((id, idx) => (
                      <span key={idx} className="text-xs text-gray-400 bg-black px-1.5 py-0.5 border border-[#222]">
                        {id.substring(0, 8)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-[#222] flex items-center justify-between">
              {finding.review_status === 'pending' ? (
                <div className="flex gap-2 w-full">
                  <button 
                    onClick={() => onReview(finding.id, 'approved')}
                    className="flex-1 py-1.5 bg-green-950/20 text-green-500 border border-green-900 hover:bg-green-900 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => onReview(finding.id, 'rejected')}
                    className="flex-1 py-1.5 bg-red-950/20 text-red-500 border border-red-900 hover:bg-red-900 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider"
                  >
                    Reject
                  </button>
                </div>
              ) : (
                <div className="w-full text-center">
                  <span className={`text-xs font-bold uppercase tracking-widest ${finding.review_status === 'approved' ? 'text-green-500' : 'text-red-500'}`}>
                    {finding.review_status}
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
