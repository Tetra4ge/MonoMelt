import React, { useState } from 'react';
import api  from '../../lib/api';

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
      const response = await api.post(`/api/projects/${projectId}/sources/zip`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const data = response.data;
      
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
      const response = await api.post(`/api/projects/${projectId}/sources/github`, { repoUrl, branch });
      onJobStarted(response.data.data.jobId);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#111] p-6 rounded-none border border-[#222]">
        <h3 className="text-xl font-bold mb-4">Upload ZIP Archive</h3>
        <form onSubmit={handleZipUpload} className="space-y-4">
          <input 
            type="file" 
            accept=".zip" 
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-0 file:text-sm file:font-bold file:bg-[#222] file:text-white hover:file:bg-[#333] cursor-pointer"
          />
          <button 
            type="submit" 
            disabled={!file || isUploading}
            className="px-4 py-2 bg-white hover:bg-gray-200 text-black font-bold uppercase rounded-none disabled:opacity-50 text-sm"
          >
            {isUploading ? 'Uploading...' : 'Upload ZIP'}
          </button>
        </form>
      </div>

      <div className="bg-[#111] p-6 rounded-none border border-[#222]">
        <h3 className="text-xl font-bold mb-4">Import from GitHub</h3>
        <form onSubmit={handleGithubImport} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Repository URL</label>
            <input 
              type="text" 
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full bg-[#0a0a0a] border border-[#222] rounded-none px-4 py-2 focus:outline-none focus:border-white text-white font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Branch</label>
            <input 
              type="text" 
              value={branch}
              onChange={e => setBranch(e.target.value)}
              placeholder="main"
              className="w-full bg-[#0a0a0a] border border-[#222] rounded-none px-4 py-2 focus:outline-none focus:border-white text-white font-mono text-sm"
            />
          </div>
          <button 
            type="submit" 
            disabled={!repoUrl || isUploading}
            className="px-4 py-2 bg-white hover:bg-gray-200 text-black font-bold uppercase rounded-none disabled:opacity-50 text-sm"
          >
            {isUploading ? 'Importing...' : 'Import Repository'}
          </button>
        </form>
      </div>
      
      {error && <p className="text-red-400">{error}</p>}
    </div>
  );
}
