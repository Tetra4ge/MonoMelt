import React from 'react';
import { Play, Pause, RotateCcw, StepForward, Terminal, Radio } from 'lucide-react';
import type { TwinProjectSummary } from '../../types/twin.types';

interface TwinHeaderProps {
  projectId?: string;
  projectSummary?: TwinProjectSummary | null;
  mode: 'live' | 'simulation';
  isSimulating: boolean;
  isPaused: boolean;
  simSpeed: 1 | 2 | 4;
  progress: number;
  onModeChange: (m: 'live' | 'simulation') => void;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSpeedChange: (speed: 1 | 2 | 4) => void;
}

export const TwinHeader: React.FC<TwinHeaderProps> = ({
  projectId,
  projectSummary,
  mode,
  isSimulating,
  isPaused,
  simSpeed,
  progress,
  onModeChange,
  onPlay,
  onPause,
  onStep,
  onReset,
  onSpeedChange,
}) => {
  return (
    <div className="border-b border-[#222] bg-[#0a0a0a] p-4 text-xs font-mono text-gray-300">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        
        {/* Title & Project Identification */}
        <div className="flex items-center gap-3">
          <Terminal className="h-5 w-5 text-white shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider text-white">DIGITAL TWIN OBSERVATORY</span>
              <span className="text-gray-600">/</span>
              <span className="text-gray-400">ARCHITECTURAL HUD</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
              <span className="font-bold text-gray-300">
                PROJECT: {projectSummary?.projectName || (projectId ? projectId.slice(0, 8) : 'SANDBOX_DEMO')}
              </span>
              <span>•</span>
              <span className="text-gray-400">
                SOURCE: {projectSummary?.sourceType?.toUpperCase() || 'CODEBASE'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className={`inline-block h-1.5 w-1.5 ${isSimulating ? 'bg-white animate-pulse' : 'bg-gray-600'}`} />
                {isSimulating ? 'ACTIVE_EXECUTION' : isPaused ? 'SUSPENDED' : 'STANDBY'}
              </span>
            </div>
          </div>
        </div>

        {/* Real Codebase Scope Badge */}
        {projectSummary && (
          <div className="hidden xl:flex items-center gap-3 border border-[#222] bg-[#111] px-3 py-1.5 text-[11px] text-gray-400">
            <span className="text-white font-bold">{projectSummary.fileCount} FILES</span>
            <span className="text-gray-600">•</span>
            <span className="text-white font-bold">{projectSummary.classCount} CLASSES</span>
            <span className="text-gray-600">•</span>
            <span className="text-white font-bold">{projectSummary.edgeCount} EDGES</span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-300 truncate max-w-[160px]">{projectSummary.primaryLanguages}</span>
          </div>
        )}

        {/* Progress Bar Display */}
        <div className="flex items-center gap-2 border border-[#222] bg-[#111] px-3 py-1.5 text-[11px]">
          <span className="text-gray-500">STAGE PROGRESS:</span>
          <div className="h-2 w-32 bg-[#222] overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-bold text-white min-w-[32px] text-right">{progress}%</span>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Mode Selector */}
          <div className="flex border border-[#222] bg-[#111] p-0.5">
            <button
              onClick={() => onModeChange('simulation')}
              className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-colors ${
                mode === 'simulation'
                  ? 'bg-white text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              SIMULATION
            </button>
            <button
              onClick={() => onModeChange('live')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold uppercase transition-colors ${
                mode === 'live'
                  ? 'bg-white text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Radio className="h-3 w-3" />
              LIVE TELEMETRY
            </button>
          </div>

          {/* Playback Controls (Active in Simulation Mode) */}
          {mode === 'simulation' && (
            <div className="flex items-center gap-1 border border-[#222] bg-[#111] p-0.5">
              {!isSimulating ? (
                <button
                  onClick={onPlay}
                  title="Run Simulation"
                  className="flex items-center gap-1 bg-white text-black px-2.5 py-1 text-[11px] font-bold hover:bg-gray-200 transition-colors"
                >
                  <Play className="h-3 w-3 fill-current" />
                  RUN
                </button>
              ) : (
                <button
                  onClick={onPause}
                  title="Pause Simulation"
                  className="flex items-center gap-1 bg-[#222] text-white px-2.5 py-1 text-[11px] font-bold hover:bg-[#333] transition-colors"
                >
                  <Pause className="h-3 w-3 fill-current" />
                  PAUSE
                </button>
              )}

              <button
                onClick={onStep}
                title="Step Forward One Stage"
                className="border border-transparent hover:border-[#333] text-gray-400 hover:text-white px-2 py-1 text-[11px] font-bold transition-colors"
              >
                <StepForward className="h-3 w-3" />
              </button>

              <button
                onClick={onReset}
                title="Reset Pipeline"
                className="border border-transparent hover:border-[#333] text-gray-400 hover:text-white px-2 py-1 text-[11px] font-bold transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
              </button>

              {/* Speed Pills */}
              <div className="ml-1 flex border-l border-[#222] pl-1">
                {([1, 2, 4] as const).map((spd) => (
                  <button
                    key={spd}
                    onClick={() => onSpeedChange(spd)}
                    className={`px-1.5 py-0.5 text-[10px] font-bold ${
                      simSpeed === spd
                        ? 'bg-white text-black'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
