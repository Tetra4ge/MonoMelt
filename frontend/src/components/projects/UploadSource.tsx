import React, { useState } from 'react';
import { UploadCloud, GitBranch, ArrowRight, CheckCircle2, FileArchive } from 'lucide-react';
import api from '../../lib/api';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null) {
    const response = Reflect.get(error, 'response');
    const data = typeof response === 'object' && response !== null ? Reflect.get(response, 'data') : undefined;
    const message = typeof data === 'object' && data !== null ? Reflect.get(data, 'message') : Reflect.get(error, 'message');
    if (typeof message === 'string') return message;
  }
  return fallback;
};

interface UploadSourceProps {
  projectId?: string;
  onJobStarted?: (jobId: string, projectId: string) => void;
  onSourceUploaded?: () => void;
}

export function UploadSource({ projectId, onJobStarted, onSourceUploaded }: UploadSourceProps) {
  const [activeTab, setActiveTab] = useState<'zip' | 'github'>('zip');
  const [file, setFile] = useState<File | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const ensureProject = async (sourceType: 'zip' | 'github', nameHint?: string): Promise<string> => {
    if (projectId) return projectId;

    let projName = `Monolith_${Math.floor(Math.random() * 9000 + 1000)}`;
    if (nameHint) {
      const cleanName = nameHint.split('/').pop()?.replace('.zip', '').replace('.git', '');
      if (cleanName) projName = cleanName;
    }

    const res = await api.post('/api/projects', {
      name: projName,
      description: 'Microservice transformation workspace',
      source_type: sourceType
    });

    return res.data.data.id;
  };

  const handleZipUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setError('');

    try {
      const targetProjectId = await ensureProject('zip', file.name);

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(`/api/projects/${targetProjectId}/sources/zip`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const data = response.data;
      if (data.success && data.data?.jobId) {
        onJobStarted?.(data.data.jobId, targetProjectId);
        onSourceUploaded?.();
      }
    } catch (err: unknown) {
      console.error('ZIP Upload Error:', err);
      setError(getErrorMessage(err, 'Failed to upload ZIP archive'));
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
      const targetProjectId = await ensureProject('github', repoUrl);

      const response = await api.post(`/api/projects/${targetProjectId}/sources/github`, { repoUrl, branch });
      if (response.data.success && response.data.data?.jobId) {
        onJobStarted?.(response.data.data.jobId, targetProjectId);
        onSourceUploaded?.();
      }
    } catch (err: unknown) {
      console.error('GitHub Import Error:', err);
      setError(getErrorMessage(err, 'Failed to import GitHub repository'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Mode Switcher Pills */}
      <div className="flex items-center gap-2 bg-[#09090b] p-1.5 rounded-full border border-[#232328] w-fit">
        <button
          type="button"
          onClick={() => { setActiveTab('zip'); setError(''); }}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'zip'
              ? 'bg-white text-black shadow-md font-bold'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FileArchive className="w-3.5 h-3.5" />
          ZIP Archive Upload
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('github'); setError(''); }}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'github'
              ? 'bg-white text-black shadow-md font-bold'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5" />
          GitHub Repository
        </button>
      </div>

      {/* ZIP Form */}
      {activeTab === 'zip' ? (
        <form onSubmit={handleZipUpload} className="space-y-4">
          <div className="bg-[#09090b] border border-dashed border-[#27272e] hover:border-lime-400/80 rounded-2xl p-6 text-center transition-all cursor-pointer relative group">
            <input 
              type="file" 
              accept=".zip" 
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            
            <div className="w-10 h-10 rounded-xl bg-[#141417] border border-[#232328] text-zinc-400 group-hover:text-lime-400 flex items-center justify-center mx-auto mb-2 transition-colors">
              <UploadCloud className="w-5 h-5" />
            </div>

            {file ? (
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-lime-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
              </div>
            ) : (
              <div>
                <span className="text-xs font-bold text-white block">Click or Drag & Drop ZIP Archive</span>
                <span className="text-[11px] text-zinc-500 block mt-0.5">Supports Java, C#, Go, Python, and Node.js monolith repositories</span>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={!file || isUploading}
            className="btn-primary text-xs w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{isUploading ? 'Uploading Archive & Parsing AST...' : 'Upload & Start AST Analysis'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      ) : (
        /* GitHub Import Form */
        <form onSubmit={handleGithubImport} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Repository URL</label>
              <input 
                type="text" 
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repository"
                className="w-full bg-[#09090b] border border-[#232328] rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Branch Name</label>
              <input 
                type="text" 
                value={branch}
                onChange={e => setBranch(e.target.value)}
                placeholder="main"
                className="w-full bg-[#09090b] border border-[#232328] rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={!repoUrl || isUploading}
            className="btn-primary text-xs w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{isUploading ? 'Connecting Repository...' : 'Connect & Import Repository'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      {error && (
        <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 px-4 py-2.5 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}
    </div>
  );
}
