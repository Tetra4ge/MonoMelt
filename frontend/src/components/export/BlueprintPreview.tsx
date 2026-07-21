import { useState } from 'react';
import { FileCode, FolderGit2, Terminal, Copy, Check } from 'lucide-react';
import type { Blueprint } from '../../features/export/types';

interface BlueprintPreviewProps {
  blueprint: Blueprint;
}

export default function BlueprintPreview({ blueprint }: BlueprintPreviewProps) {
  const terraformFiles = blueprint.terraform_code || {};
  const fileNames = Object.keys(terraformFiles);
  const [activeFile, setActiveFile] = useState<string>(fileNames[0] || '');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!activeFile || !terraformFiles[activeFile]) return;
    navigator.clipboard.writeText(terraformFiles[activeFile]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#222] rounded-md shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">
      
      {/* Sidebar: File Explorer */}
      <div className="w-full md:w-64 bg-[#111] border-r border-[#222] flex flex-col">
        <div className="px-4 py-3 border-b border-[#222] flex items-center gap-2">
          <FolderGit2 className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Workspace</span>
        </div>
        <div className="p-2 flex-grow overflow-y-auto">
          {fileNames.map((filename) => (
            <button
              key={filename}
              onClick={() => setActiveFile(filename)}
              className={`w-full text-left px-3 py-2 rounded-sm text-sm font-mono flex items-center gap-2 transition-colors ${
                activeFile === filename 
                  ? 'bg-blue-900/20 text-blue-400 border border-blue-900/30' 
                  : 'text-gray-400 hover:bg-[#222] hover:text-gray-200 border border-transparent'
              }`}
            >
              <FileCode className="w-4 h-4 shrink-0" />
              <span className="truncate">{filename}</span>
            </button>
          ))}
          {fileNames.length === 0 && (
            <p className="text-xs text-gray-500 px-3 py-4 italic">No files generated.</p>
          )}
        </div>
      </div>

      {/* Main Content: Code Editor View */}
      <div className="flex-grow flex flex-col bg-[#050505]">
        {/* Editor Tab Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#222] bg-[#0a0a0a]">
          <div className="flex items-center gap-2 text-gray-300 font-mono text-sm">
            <Terminal className="w-4 h-4 text-emerald-500" />
            {activeFile || 'No file selected'}
          </div>
          <button 
            onClick={handleCopy}
            disabled={!activeFile}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-[#222] rounded-sm transition-colors disabled:opacity-50"
            title="Copy to clipboard"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        
        {/* Code View */}
        <div className="flex-grow p-4 overflow-auto font-mono text-sm">
          {activeFile && terraformFiles[activeFile] ? (
            <pre className="text-gray-300 whitespace-pre-wrap leading-relaxed">
              <code>{terraformFiles[activeFile]}</code>
            </pre>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-600 italic">
              Select a file to view its contents
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
