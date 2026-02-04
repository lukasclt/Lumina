import React from 'react';
import { VideoSegment, Tool } from '../types';
import { Eye, Volume2, Lock } from 'lucide-react';

interface TimelineProps {
  duration: number;
  currentTime: number;
  layers: VideoSegment[];
  selectedLayerId: string | null;
  onSeek: (time: number) => void;
  onSelectLayer: (id: string) => void;
  activeTool: Tool;
}

export const Timeline: React.FC<TimelineProps> = ({ 
  duration, 
  currentTime, 
  layers, 
  selectedLayerId,
  onSeek, 
  onSelectLayer,
  activeTool
}) => {
  const tracks = [2, 1, 0]; // V3, V2, V1 (Visual stack order)
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === Tool.SELECTION || activeTool === Tool.RAZOR) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        onSeek(percentage * duration);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#121212] select-none text-xs">
      {/* Time Ruler */}
      <div className="h-6 bg-[#1e1e1e] border-b border-[#2a2a2a] flex items-end relative overflow-hidden ml-24"
           onClick={handleTrackClick}>
        <div className="absolute inset-0 flex justify-between px-2 text-[10px] text-gray-500 pointer-events-none select-none">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className="border-l border-gray-700 pl-1 h-3 mt-auto">
                {formatTime((duration / 10) * i)}
            </span>
          ))}
        </div>
        {/* Playhead Head */}
        <div 
            className="absolute top-0 bottom-0 w-0 z-20"
            style={{ left: `${(currentTime / duration) * 100}%` }}
        >
             <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-blue-500 -ml-[6px]"></div>
        </div>
      </div>

      <div className="flex-1 flex overflow-y-auto custom-scrollbar">
        {/* Track Headers */}
        <div className="w-24 flex-shrink-0 bg-[#1e1e1e] border-r border-[#2a2a2a] flex flex-col">
          {tracks.map((trackId) => (
            <div key={trackId} className="h-16 border-b border-[#2a2a2a] flex flex-col justify-center px-2 gap-1 relative group">
              <div className="flex items-center justify-between text-gray-400">
                 <span className="font-bold text-blue-400">V{trackId + 1}</span>
                 <div className="flex gap-1">
                    <Lock className="w-3 h-3 hover:text-white cursor-pointer"/>
                    <Eye className="w-3 h-3 hover:text-white cursor-pointer"/>
                 </div>
              </div>
              <div className="h-0.5 w-full bg-[#2a2a2a]"></div>
            </div>
          ))}
          <div className="h-16 border-b border-[#2a2a2a] flex flex-col justify-center px-2 bg-[#1a1a1a]">
              <div className="flex items-center justify-between text-gray-400">
                 <span className="font-bold text-green-400">A1</span>
                 <div className="flex gap-1">
                    <Volume2 className="w-3 h-3 hover:text-white cursor-pointer"/>
                 </div>
              </div>
          </div>
        </div>

        {/* Tracks Content */}
        <div className="flex-1 relative bg-[#121212] cursor-crosshair" onClick={handleTrackClick}>
          {/* Playhead Line */}
          <div 
            className="absolute top-0 bottom-0 w-px bg-blue-500 z-10 pointer-events-none"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          />

          {tracks.map((trackId) => (
            <div key={trackId} className="h-16 border-b border-[#2a2a2a] relative w-full">
              {layers.filter(l => l.track === trackId).map((layer) => {
                const left = (layer.start / duration) * 100;
                const width = (layer.duration / duration) * 100;
                const isSelected = selectedLayerId === layer.id;
                
                let bgColor = 'bg-blue-900/60 border-blue-700';
                if (layer.type === 'text') bgColor = 'bg-pink-900/60 border-pink-700';
                if (layer.type === 'image') bgColor = 'bg-purple-900/60 border-purple-700';
                if (isSelected) bgColor = 'bg-white/20 border-white';

                return (
                  <div
                    key={layer.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectLayer(layer.id);
                    }}
                    className={`absolute top-1 bottom-1 rounded-sm border-2 cursor-pointer transition-all overflow-hidden ${bgColor}`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      minWidth: '4px'
                    }}
                  >
                    <div className="px-2 py-0.5 text-[10px] text-white/90 font-medium truncate drop-shadow-md">
                      {layer.label}
                    </div>
                    {/* Visual waveform/thumb simulation */}
                    <div className="absolute bottom-0 left-0 right-0 h-1/2 opacity-20 bg-black/20"></div>
                  </div>
                );
              })}
            </div>
          ))}
          
          {/* Audio Track Simulation */}
           <div className="h-16 border-b border-[#2a2a2a] relative w-full bg-[#151515]">
                <div className="absolute top-1 bottom-1 left-0 w-full bg-green-900/30 border border-green-800/50 flex items-center justify-center">
                    <span className="text-[10px] text-green-500 opacity-50">Master Audio</span>
                </div>
           </div>
        </div>
      </div>
    </div>
  );
};