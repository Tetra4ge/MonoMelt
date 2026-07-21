import type { PlanRevision } from '../../features/planning/types';

interface PlanRevisionHistoryProps {
  revisions: PlanRevision[];
  activeRevisionId?: string;
  onSelect: (revision: PlanRevision) => void;
}

export default function PlanRevisionHistory({ revisions, activeRevisionId, onSelect }: PlanRevisionHistoryProps) {
  return (
    <aside className="border border-[#222] bg-[#111] p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">revision_history</p>
      <h2 className="mt-2 text-sm font-bold text-white">&gt; immutable_reports</h2>
      <div className="mt-4 space-y-2">
        {revisions.map(revision => <button key={revision.id} type="button" onClick={() => onSelect(revision)} className={`w-full border p-3 text-left text-xs transition ${activeRevisionId === revision.id ? 'border-white bg-[#0a0a0a] text-white' : 'border-[#222] bg-[#0a0a0a] text-gray-500 hover:border-[#555] hover:text-white'}`}><span className="font-bold">revision_{revision.revision_number}</span><span className="mt-1 block text-[10px]">{new Date(revision.created_at).toLocaleString()}</span></button>)}
        {revisions.length === 0 && <p className="text-xs text-gray-600">No revisions yet.</p>}
      </div>
    </aside>
  );
}
