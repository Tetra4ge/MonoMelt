import { useEffect, useState } from 'react';
import api from '../../lib/api';

interface IngestionStatusProps {
  projectId: string;
  jobId: string;
}

export function IngestionStatus({ projectId, jobId }: IngestionStatusProps) {
  const [job, setJob] = useState<{ status: string; error_code?: string | null } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchJobStatus = async () => {
      try {
        const response = await api.get(`/api/projects/${projectId}/jobs/${jobId}`);
        const currentJob = response.data.data;
        setJob(currentJob);
        
        // Stop polling if job is completed, failed, cancelled, or ready
        if (['ready', 'completed', 'failed', 'cancelled'].includes(currentJob.status)) {
          clearInterval(intervalId);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to load job status';
        setError(message);
        clearInterval(intervalId);
      }
    };

    const intervalId = setInterval(fetchJobStatus, 2000); // Poll every 2 seconds
    fetchJobStatus(); // Initial fetch

    return () => { if (intervalId) clearInterval(intervalId); };
  }, [projectId, jobId]);

  if (error) return <div className="border border-[#555] bg-[#111] p-4 text-xs text-gray-300">Error: {error}</div>;
  if (!job) return <div className="text-gray-400">Loading job status...</div>;

  return (
    <div className="border border-[#222] bg-[#111] p-6">
      <h3 className="text-xl font-bold mb-4">Ingestion Status</h3>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Status</span>
          <span className="border border-[#333] px-2 py-1 text-xs font-semibold text-gray-300">
          
            {job.status.toUpperCase()}
          </span>
        </div>
        
        {job.error_code && (
          <div className="flex flex-col gap-1 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <span className="text-red-400 font-semibold text-sm">Error Details</span>
            <span className="text-red-300 text-sm">{job.error_code}</span>
          </div>
        )}
      </div>
    </div>
  );
}
