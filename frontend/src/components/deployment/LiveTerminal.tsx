import { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

interface LiveTerminalProps {
  logs: string[];
}

export default function LiveTerminal({ logs }: LiveTerminalProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div className="bg-[#050505] border border-[#222] rounded-md shadow-2xl overflow-hidden flex flex-col h-[400px]">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#111] border-b border-[#222]">
        <Terminal className="w-4 h-4 text-emerald-500" />
        <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Live Deployment Logs</span>
      </div>
      
      <div className="p-4 flex-grow overflow-y-auto font-mono text-xs sm:text-sm">
        {logs.map((log, index) => {
          let colorClass = "text-gray-400";
          if (log.includes('[SYSTEM]')) colorClass = "text-blue-400 font-bold";
          if (log.includes('[DOCKER]')) colorClass = "text-cyan-400";
          if (log.includes('[TERRAFORM]')) colorClass = "text-purple-400";
          if (log.includes('successfully') || log.includes('ready')) colorClass = "text-emerald-400 font-bold";
          if (log.includes('Error') || log.includes('Failed')) colorClass = "text-red-500 font-bold";

          return (
            <div key={index} className={`mb-1 leading-relaxed ${colorClass}`}>
              <span className="text-gray-600 mr-3">{new Date().toISOString().split('T')[1].split('.')[0]}</span>
              {log}
            </div>
          );
        })}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
