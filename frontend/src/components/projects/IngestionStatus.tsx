import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface IngestionStatusProps {
  projectId: string;
  jobId: string;
}

export function IngestionStatus({ projectId, jobId }: IngestionStatusProps) {
  const [job, setJob] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let intervalId: any;

    const fetchJobStatus = async () => {
      try {
        const response = await api.get(`/projects/${projectId}/jobs/${jobId}`);
        const currentJob = response.data.data;
        setJob(currentJob);
        
        // Stop polling if job is completed, failed, cancelled, or ready
        if (['ready', 'completed', 'failed', 'cancelled'].includes(currentJob.status)) {
          clearInterval(intervalId);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || err.message);
        clearInterval(intervalId);
      }
    };

    fetchJobStatus(); // Initial fetch
    intervalId = setInterval(fetchJobStatus, 2000); // Poll every 2 seconds

    return () => clearInterval(intervalId);
  }, [projectId, jobId]);

  if (error) return <div className="text-red-400 p-4 bg-red-400/10 rounded-lg">Error: {error}</div>;
  if (!job) return <div className="text-gray-400">Loading job status...</div>;

  return (
    <div className="bg-white/5 p-6 rounded-xl border border-white/10">
      <h3 className="text-xl font-bold mb-4">Ingestion Status</h3>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Status</span>
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
            job.status === 'ready' || job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
            job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
            'bg-blue-500/20 text-blue-400'
          }`}>
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
