import React, { useState } from 'react';
import { api } from '../../lib/api';

interface UploadSourceProps {
  projectId: string;
  onJobStarted: (jobId: string) => void;
}

export function UploadSource({ projectId, onJobStarted }: UploadSourceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const handleZipUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Assuming api.ts has a method for multipart/form-data, or we just use fetch
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/projects/${projectId}/sources/zip`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Upload failed');
      
      onJobStarted(data.data.jobId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGithubImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl) return;

    setIsUploading(true);
    setError('');

    try {
      const response = await api.post(`/projects/${projectId}/sources/github`, { repoUrl, branch });
      onJobStarted(response.data.data.jobId);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/5 p-6 rounded-xl border border-white/10">
        <h3 className="text-xl font-bold mb-4">Upload ZIP Archive</h3>
        <form onSubmit={handleZipUpload} className="space-y-4">
          <input 
            type="file" 
            accept=".zip" 
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600"
          />
          <button 
            type="submit" 
            disabled={!file || isUploading}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Upload ZIP'}
          </button>
        </form>
      </div>

      <div className="bg-white/5 p-6 rounded-xl border border-white/10">
        <h3 className="text-xl font-bold mb-4">Import from GitHub</h3>
        <form onSubmit={handleGithubImport} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Repository URL</label>
            <input 
              type="text" 
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Branch</label>
            <input 
              type="text" 
              value={branch}
              onChange={e => setBranch(e.target.value)}
              placeholder="main"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button 
            type="submit" 
            disabled={!repoUrl || isUploading}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium disabled:opacity-50"
          >
            {isUploading ? 'Importing...' : 'Import Repository'}
          </button>
        </form>
      </div>
      
      {error && <p className="text-red-400">{error}</p>}
    </div>
  );
}
