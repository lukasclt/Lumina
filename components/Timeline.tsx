import React from 'react';
import { VideoSegment, Tool } from '../types';
import { Eye, Volume2, Lock, Mic, Layers } from 'lucide-react';

interface TimelineProps {
  duration: number;
  currentTime: number;
  layers: VideoSegment[];
  selectedLayerId: string | null;
  onSeek: (time: number) => void;
  onSelectLayer: (id: string) => void;
  onRazor: (time: number, layerId: string) => void;
  activeTool: Tool;
}

export const Timeline: React.FC<TimelineProps> = ({ 
  duration, 
  currentTime, 
  layers, 
  selectedLayerId,
  onSeek, 
  onSelectLayer,
  onRazor,
  activeTool
}) => {
  const vTracks = [2, 1, 0]; // V3, V2, V1
  const aTracks = [0, 1]; // A1, A2
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30); // 30fps assumption
    return `${mins}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const clickTime = percentage * duration;

    // Default seek behavior if clicking on ruler or empty space (unless handled by layer click)
    onSeek(clickTime);
  };

  const handleLayerClick = (e: React.MouseEvent<HTMLDivElement>, layer: VideoSegment) => {
      e.stopPropagation();
      
      if (activeTool === Tool.RAZOR) {
          const rect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect(); // Get timeline width container
          if (rect) {
             const x = e.clientX - rect.left;
             const percentage = Math.max(0, Math.min(1, x / rect.width));
             const clickTime = percentage * duration;
             onRazor(clickTime, layer.id);
          }
      } else {
          onSelectLayer(layer.id);
      }
  };

  const getCursor = () => {
      switch(activeTool) {
          case Tool.RAZOR: return 'cursor-crosshair'; 
          case Tool.HAND: return 'cursor-grab';
          case Tool.RIPPLE_EDIT: return 'cursor-col-resize';
          case Tool.ROLLING_EDIT: return 'cursor-ew-resize';
          default: return 'cursor-default';
      }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#161616] select-none text-[10px] font-sans overflow-hidden">
      
      {/* Time Ruler */}
      <div className="h-6 bg-[#1e1e1e] border-b border-[#2a2a2a] flex items-end relative ml-24 cursor-pointer"
           onClick={handleTimelineClick}>
        <div className="absolute inset-0 flex justify-between px-2 text-gray-500 pointer-events-none select-none">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex flex-col justify-end h-full pb-1">
                <span className="border-l border-gray-600 h-1 mb-0.5"></span>
                <span>{formatTime((duration / 10) * i)}</span>
            </div>
          ))}
        </div>
        {/* Playhead Head */}
        <div 
            className="absolute top-0 bottom-0 w-px bg-blue-500 z-30"
            style={{ left: `${(currentTime / duration) * 100}%` }}
        >
             <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-blue-500 rotate-45 rounded-sm"></div>
        </div>
      </div>

      <div className="flex-1 flex overflow-y-auto custom-scrollbar">
        
        {/* Track Headers */}
        <div className="w-24 flex-shrink-0 bg-[#1e1e1e] border-r border-[#121212] flex flex-col">
          {/* Video Tracks */}
          {vTracks.map((trackId) => (
            <div key={`v-${trackId}`} className="h-16 border-b border-[#2a2a2a] flex flex-col justify-center px-1 gap-1 relative group bg-[#232323]">
              <div className="flex items-center gap-1 text-gray-400">
                 <div className="w-4 h-full flex items-center justify-center border-r border-[#333] mr-1 text-blue-400 font-bold">V{trackId + 1}</div>
                 <Eye className="w-3 h-3 hover:text-white cursor-pointer"/>
                 <Lock className="w-3 h-3 hover:text-white cursor-pointer"/>
              </div>
            </div>
          ))}
          
          {/* Divider */}
          <div className="h-4 bg-[#121212] border-b border-[#2a2a2a]"></div>

          {/* Audio Tracks */}
          {aTracks.map((trackId) => (
            <div key={`a-${trackId}`} className="h-16 border-b border-[#2a2a2a] flex flex-col justify-center px-1 gap-1 relative group bg-[#232323]">
               <div className="flex items-center gap-1 text-gray-400">
                 <div className="w-4 h-full flex items-center justify-center border-r border-[#333] mr-1 text-green-400 font-bold">A{trackId + 1}</div>
                 <Volume2 className="w-3 h-3 hover:text-white cursor-pointer"/>
                 <Mic className="w-3 h-3 hover:text-red-500 cursor-pointer"/>
              </div>
            </div>
          ))}
        </div>

        {/* Timeline Content */}
        <div className={`flex-1 relative bg-[#161616] ${getCursor()}`} onClick={handleTimelineClick}>
          {/* Playhead Line */}
          <div 
            className="absolute top-0 bottom-0 w-px bg-blue-500 z-20 pointer-events-none"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          />

          {/* Video Clips */}
          {vTracks.map((trackId) => (
            <div key={`v-content-${trackId}`} className="h-16 border-b border-[#2a2a2a] relative w-full">
              {layers.filter(l => l.track === trackId).map((layer) => {
                const left = (layer.start / duration) * 100;
                const width = (layer.duration / duration) * 100;
                const isSelected = selectedLayerId === layer.id;
                
                let bgColor = 'bg-violet-800/80 border-violet-600'; // Default Video
                if (layer.type === 'text') bgColor = 'bg-pink-700/80 border-pink-500'; // Graphics
                if (layer.type === 'image') bgColor = 'bg-purple-700/80 border-purple-500';
                if (isSelected) bgColor = 'bg-gray-200 text-black border-white';

                return (
                  <div
                    key={layer.id}
                    onClick={(e) => handleLayerClick(e, layer)}
                    className={`absolute top-0.5 bottom-0.5 rounded-[2px] border cursor-pointer overflow-hidden group ${bgColor}`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      minWidth: '2px'
                    }}
                  >
                    {/* Clip Label */}
                    <div className="px-1 py-0.5 text-[9px] font-medium truncate opacity-90 flex items-center gap-1">
                        {layer.type === 'video' && <span className="opacity-50">[V]</span>}
                        {layer.label}
                    </div>
                    
                    {/* Razor Line Indicator (Visual only, would need mouse tracking for perfect UX) */}
                    {activeTool === Tool.RAZOR && (
                        <div className="hidden group-hover:block absolute top-0 bottom-0 w-0.5 bg-white mix-blend-difference pointer-events-none" style={{left: '50%'}}></div>
                    )}

                    {/* Selection Handles */}
                    {isSelected && activeTool === Tool.SELECTION && (
                        <>
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/50 cursor-w-resize"></div>
                            <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/50 cursor-e-resize"></div>
                        </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          <div className="h-4 bg-[#121212] border-b border-[#2a2a2a]"></div>

          {/* Audio Clips (Simulated) */}
          {aTracks.map((trackId) => (
             <div key={`a-content-${trackId}`} className="h-16 border-b border-[#2a2a2a] relative w-full bg-[#181818]">
                {trackId === 0 && (
                     <div className="absolute top-1 bottom-1 left-0 right-0 bg-emerald-900/40 border border-emerald-800/50 m-1 rounded flex items-center justify-center pointer-events-none">
                         <span className="text-emerald-500/50 text-[9px] tracking-widest">AUDIO WAVEFORM SIMULATION</span>
                     </div>
                )}
             </div>
          ))}
        </div>
      </div>
    </div>
  );
};