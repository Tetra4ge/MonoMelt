import { useMemo, useState } from 'react';
import { FileCode, FolderGit2, Terminal, Copy, Check } from 'lucide-react';

interface BlueprintPreviewProps {
  /** path inside the ZIP -> text content */
  files: Record<string, string>;
}

// Show the most informative files first.
const PRIORITY = ['README.md', 'terraform/main.tf', 'manifest.json'];

const displayPath = (path: string) => path.replace(/^blueprint\//, '');

export default function BlueprintPreview({ files }: BlueprintPreviewProps) {
  const fileNames = useMemo(() => {
    const names = Object.keys(files).sort((a, b) => {
      const rank = (n: string) => {
        const idx = PRIORITY.findIndex(p => displayPath(n).endsWith(p));
        return idx === -1 ? PRIORITY.length : idx;
      };
      return rank(a) - rank(b) || a.localeCompare(b);
    });
    return names;
  }, [files]);

  const [selected, setSelected] = useState<string>('');
  const activeFile = selected && files[selected] !== undefined ? selected : fileNames[0] || '';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(files[activeFile]).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => undefined);
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#222] rounded-md shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">

      {/* Sidebar: File Explorer */}
      <div className="w-full md:w-72 bg-[#111] border-r border-[#222] flex flex-col">
        <div className="px-4 py-3 border-b border-[#222] flex items-center gap-2">
          <FolderGit2 className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Workspace ({fileNames.length})</span>
        </div>
        <div className="p-2 flex-grow overflow-y-auto max-h-[600px]">
          {fileNames.map((filename) => (
            <button
              key={filename}
              onClick={() => setSelected(filename)}
              title={displayPath(filename)}
              className={`w-full text-left px-3 py-2 rounded-sm text-xs font-mono flex items-center gap-2 transition-colors ${
                activeFile === filename
                  ? 'bg-blue-900/20 text-blue-400 border border-blue-900/30'
                  : 'text-gray-400 hover:bg-[#222] hover:text-gray-200 border border-transparent'
              }`}
            >
              <FileCode className="w-4 h-4 shrink-0" />
              <span className="truncate">{displayPath(filename)}</span>
            </button>
          ))}
          {fileNames.length === 0 && (
            <p className="text-xs text-gray-500 px-3 py-4 italic">No files generated.</p>
          )}
        </div>
      </div>

      {/* Main Content: Code Editor View */}
      <div className="flex-grow flex flex-col bg-[#050505] min-w-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#222] bg-[#0a0a0a]">
          <div className="flex items-center gap-2 text-gray-300 font-mono text-sm min-w-0">
            <Terminal className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="truncate">{activeFile ? displayPath(activeFile) : 'No file selected'}</span>
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

        <div className="flex-grow p-4 overflow-auto font-mono text-sm">
          {activeFile ? (
            <pre className="text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
              <code>{files[activeFile]}</code>
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
