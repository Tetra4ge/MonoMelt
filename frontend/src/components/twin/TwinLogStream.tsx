import React, { useState } from 'react';
import type { TwinLog } from '../../types/twin.types';
import { Terminal, Trash2 } from 'lucide-react';

interface TwinLogStreamProps {
  logs: TwinLog[];
  onClear?: () => void;
}

export const TwinLogStream: React.FC<TwinLogStreamProps> = ({ logs, onClear }) => {
  const [filter, setFilter] = useState<'ALL' | 'INFO' | 'EXEC' | 'DONE'>('ALL');

  const filteredLogs = logs.filter((log) => {
    if (filter === 'ALL') return true;
    return log.level === filter;
  });

  const getLevelStyle = (level: TwinLog['level']) => {
    switch (level) {
      case 'DONE':
        return 'text-white font-bold bg-[#222] px-1';
      case 'EXEC':
        return 'text-gray-200 font-bold';
      case 'WARN':
        return 'text-gray-400 bg-[#333] px-1';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="border-t border-[#222] bg-[#0a0a0a] font-mono text-xs flex flex-col h-48">
      
      {/* Console Top Bar */}
      <div className="flex items-center justify-between border-b border-[#222] bg-[#111] px-4 py-2 text-[11px]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-gray-300">
            <Terminal className="h-3.5 w-3.5 text-white" />
            <span className="font-bold text-white">LIVE EVENT BUS LOGS</span>
          </div>
          <span className="text-gray-600">|</span>
          <div className="flex items-center gap-1">
            {(['ALL', 'INFO', 'EXEC', 'DONE'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilter(lvl)}
                className={`px-1.5 py-0.5 text-[10px] ${
                  filter === lvl
                    ? 'bg-white text-black font-bold'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 text-gray-500">
          <span>{filteredLogs.length} EVENTS</span>
          {onClear && (
            <button
              onClick={onClear}
              title="Clear event logs"
              className="hover:text-white transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Output Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 bg-[#050505] text-[11px] leading-relaxed">
        {filteredLogs.length === 0 ? (
          <div className="text-gray-600 italic">No events recorded for current filter.</div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 text-gray-400 hover:bg-[#111] px-1 py-0.5 transition-colors">
              <span className="text-gray-600 shrink-0 font-mono select-none">[{log.timestamp}]</span>
              <span className={`shrink-0 select-none ${getLevelStyle(log.level)}`}>
                {log.level}
              </span>
              <span className="text-gray-500 shrink-0 select-none">[{log.stageId}]</span>
              <span className="text-gray-300 break-all">{log.message}</span>
            </div>
          ))
        )}
      </div>

    </div>
  );
};
