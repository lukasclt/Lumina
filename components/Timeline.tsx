import React, { useState, useRef, useEffect, useMemo } from 'react';
import { VideoSegment, Tool, AnimationKeyframe, Track } from '../types';
import { Eye, Volume2, Lock, Mic, Trash2, Copy, Edit2, Activity, Layers, ZoomIn, ZoomOut, Magnet, Plus, VolumeX, Volume1, EyeOff, MoreHorizontal } from 'lucide-react';
import { GraphEditor } from './GraphEditor';

interface TimelineProps {
  duration: number;
  currentTime: number;
  zoomLevel: number;
  setZoomLevel: (z: number) => void;
  tracks: Track[];
  layers: VideoSegment[];
  selectedLayerId: string | null;
  onSeek: (time: number) => void;
  onSelectLayer: (id: string) => void;
  onRazor: (time: number, layerId: string) => void;
  onUpdateLayer: (id: string, updates: Partial<VideoSegment>) => void;
  onDuplicateLayer: (id: string, newTime: number, newTrack: number) => void;
  onDeleteLayer: (id: string) => void;
  onUpdateTrack: (id: number, updates: Partial<Track>) => void;
  onAddTrack: (type: 'video' | 'audio') => void;
  onRemoveTrack: (id: number) => void;
  activeTool: Tool;
}

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    layerId: string | null;
    trackId?: number | null;
}

type DragMode = 'MOVE' | 'RESIZE_L' | 'RESIZE_R' | null;

export const Timeline: React.FC<TimelineProps> = ({ 
  duration, 
  currentTime,
  zoomLevel,
  setZoomLevel,
  tracks,
  layers, 
  selectedLayerId,
  onSeek, 
  onSelectLayer,
  onRazor,
  onUpdateLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onUpdateTrack,
  onAddTrack,
  onRemoveTrack,
  activeTool
}) => {
  
  // Sort tracks: Video descending (V3 top, V1 bottom), Audio ascending (A1 top, A2 bottom)
  const vTracks = useMemo(() => tracks.filter(t => t.type === 'video').sort((a,b) => b.id - a.id), [tracks]);
  const aTracks = useMemo(() => tracks.filter(t => t.type === 'audio').sort((a,b) => a.id - b.id), [tracks]);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, layerId: null });
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  
  // Dragging State
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  
  const [isGraphView, setIsGraphView] = useState(false);

  // Constants
  const MIN_ZOOM = 10; // 10px per second
  const MAX_ZOOM = 200; // 200px per second
  const TRACK_HEIGHT = 64;

  // Calculate total width based on duration and zoom
  const totalWidth = Math.max(duration * zoomLevel, scrollContainerRef.current?.clientWidth || 0);

  // Close context menu
  useEffect(() => {
    const handleClick = () => setContextMenu({ ...contextMenu, visible: false });
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // Helper: Format Time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    return `${mins}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  // Helper: Snap to clips and playhead
  const getSnapTime = (targetTime: number, ignoreLayerId?: string) => {
      if (!snappingEnabled) return targetTime;
      const SNAP_THRESHOLD_PX = 10;
      const thresholdSeconds = SNAP_THRESHOLD_PX / zoomLevel;

      let closestTime = targetTime;
      let minDist = thresholdSeconds;

      // Snap to Playhead
      if (Math.abs(targetTime - currentTime) < minDist) {
          closestTime = currentTime;
          minDist = Math.abs(targetTime - currentTime);
      }

      // Snap to other clips (start and end)
      layers.forEach(l => {
          if (l.id === ignoreLayerId) return;
          
          // Snap to Start
          if (Math.abs(targetTime - l.start) < minDist) {
              closestTime = l.start;
              minDist = Math.abs(targetTime - l.start);
          }
          // Snap to End
          const end = l.start + l.duration;
          if (Math.abs(targetTime - end) < minDist) {
              closestTime = end;
              minDist = Math.abs(targetTime - end);
          }
      });

      return closestTime;
  };

  // Interaction Handlers
  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if (draggingId) return;
      if (activeTool !== Tool.SELECTION && activeTool !== Tool.RAZOR) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left + (scrollContainerRef.current?.scrollLeft || 0);
      const time = Math.max(0, clickX / zoomLevel);
      
      onSeek(time);
  };

  const handleLayerMouseDown = (e: React.MouseEvent, layer: VideoSegment, mode: DragMode) => {
      e.stopPropagation(); // Don't trigger timeline seek
      
      if (e.button === 2) {
          handleContextMenu(e, layer.id, null);
          return;
      }

      // Razor Tool
      if (activeTool === Tool.RAZOR) {
          const rect = e.currentTarget.parentElement?.getBoundingClientRect(); // Track container
          if (!rect) return;
          
          // Calculate click position relative to timeline start
          const clickXScreen = e.clientX;
          const timelineRect = scrollContainerRef.current?.getBoundingClientRect();
          if(!timelineRect) return;

          const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
          const relativeX = clickXScreen - timelineRect.left + scrollLeft;
          
          let cutTime = relativeX / zoomLevel;
          cutTime = getSnapTime(cutTime); // Snap razor

          // Guard: Valid cut time inside clip
          if (cutTime > layer.start && cutTime < (layer.start + layer.duration)) {
             onRazor(cutTime, layer.id);
          }
          return;
      }

      // Selection / Edit Tools
      if (activeTool === Tool.SELECTION) {
          onSelectLayer(layer.id);
          setDraggingId(layer.id);
          setDragMode(mode);

          const startX = e.clientX;
          const startY = e.clientY;

          const initStart = layer.start;
          const initDuration = layer.duration;
          const initTrack = layer.track;
          const initSrcStart = layer.srcStartTime || 0;

          const handleMouseMove = (ev: MouseEvent) => {
              const dx = ev.clientX - startX;
              const dy = ev.clientY - startY;
              
              const dt = dx / zoomLevel;

              if (mode === 'MOVE') {
                  let newStartTime = initStart + dt;
                  newStartTime = getSnapTime(newStartTime, layer.id);
                  newStartTime = Math.max(0, newStartTime);

                  const dTrack = Math.round(-dy / TRACK_HEIGHT);
                  // Find nearest valid track
                  // This is simplified. Ideally we find the closest track ID visually.
                  const allTrackIds = tracks.map(t => t.id);
                  let newTrack = initTrack; 
                  // Simple clamp to existing tracks roughly
                  const maxTrack = Math.max(...allTrackIds);
                  const minTrack = Math.min(...allTrackIds);
                  const proposedTrack = initTrack + dTrack;
                  
                  if (allTrackIds.includes(proposedTrack)) {
                      newTrack = proposedTrack;
                  }

                  onUpdateLayer(layer.id, { start: newStartTime, track: newTrack });
              
              } else if (mode === 'RESIZE_L') {
                  let newStart = initStart + dt;
                  newStart = getSnapTime(newStart, layer.id);
                  if (newStart < 0) newStart = 0;
                  const endTime = initStart + initDuration;
                  if (newStart > endTime - 0.04) newStart = endTime - 0.04;

                  const deltaStart = newStart - initStart;
                  const newDuration = initDuration - deltaStart;
                  const newSrcStart = initSrcStart + deltaStart;

                  if (newSrcStart < 0) return; 

                  onUpdateLayer(layer.id, { 
                      start: newStart, 
                      duration: newDuration,
                      srcStartTime: newSrcStart 
                  });

              } else if (mode === 'RESIZE_R') {
                  let newDuration = initDuration + dt;
                  const currentEnd = initStart + newDuration;
                  const snappedEnd = getSnapTime(currentEnd, layer.id);
                  newDuration = snappedEnd - initStart;
                  if (newDuration < 0.04) newDuration = 0.04;
                  onUpdateLayer(layer.id, { duration: newDuration });
              }
          };

          const handleMouseUp = () => {
              setDraggingId(null);
              setDragMode(null);
              window.removeEventListener('mousemove', handleMouseMove);
              window.removeEventListener('mouseup', handleMouseUp);
          };

          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
      }
  };

  const handleContextMenu = (e: React.MouseEvent, layerId: string | null, trackId: number | null) => {
      e.preventDefault();
      setContextMenu({ visible: true, x: e.clientX, y: e.clientY, layerId, trackId });
  };

  const getCursor = () => {
      switch(activeTool) {
          case Tool.RAZOR: return 'cursor-crosshair'; 
          case Tool.HAND: return 'cursor-grab';
          default: return 'cursor-default';
      }
  };

  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  // Ruler Ticks Generation
  const ticks = useMemo(() => {
      const tickCount = Math.ceil(totalWidth / 100) + 1; // approx every 100px
      return Array.from({ length: tickCount }).map((_, i) => {
          const time = (i * 100) / zoomLevel;
          return { left: i * 100, label: formatTime(time) };
      });
  }, [totalWidth, zoomLevel]);

  return (
    <div className="flex-1 flex flex-col bg-[#161616] select-none text-[10px] font-sans overflow-hidden relative">
      
      {/* Timeline Header Controls */}
      <div className="h-8 bg-[#1e1e1e] border-b border-[#2a2a2a] flex items-center justify-between px-2 z-30">
          <div className="flex items-center gap-2">
              <span className="text-gray-400 font-bold ml-2">Sequence 01</span>
              <span className="text-gray-600">{formatTime(duration)}</span>
          </div>
          <div className="flex items-center gap-2">
              <button onClick={() => setSnappingEnabled(!snappingEnabled)} className={`p-1 rounded ${snappingEnabled ? 'text-blue-500 bg-blue-500/10' : 'text-gray-500 hover:text-gray-300'}`} title="Snap (S)">
                  <Magnet className="w-3.5 h-3.5"/>
              </button>
              <div className="h-4 w-px bg-[#333]"></div>
              <button onClick={() => setZoomLevel(Math.max(MIN_ZOOM, zoomLevel * 0.8))} className="p-1 text-gray-400 hover:text-white"><ZoomOut className="w-3.5 h-3.5"/></button>
              <input 
                  type="range" min={MIN_ZOOM} max={MAX_ZOOM} value={zoomLevel} onChange={(e) => setZoomLevel(Number(e.target.value))}
                  className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <button onClick={() => setZoomLevel(Math.min(MAX_ZOOM, zoomLevel * 1.2))} className="p-1 text-gray-400 hover:text-white"><ZoomIn className="w-3.5 h-3.5"/></button>
              
              <div className="h-4 w-px bg-[#333] mx-1"></div>
              
              <button 
                onClick={() => setIsGraphView(!isGraphView)}
                className={`p-1 rounded hover:bg-[#333] flex items-center gap-1 ${isGraphView ? 'text-blue-500 bg-[#2a2a2a]' : 'text-gray-400'}`}
                title={isGraphView ? "Switch to Layout View" : "Switch to Graph Editor"}
              >
                  {isGraphView ? <Layers className="w-3.5 h-3.5"/> : <Activity className="w-3.5 h-3.5"/>}
              </button>
          </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Track Headers (Fixed Left) */}
        {!isGraphView && (
            <div className="w-32 flex-shrink-0 bg-[#1e1e1e] border-r border-[#121212] flex flex-col z-20 shadow-lg">
                <div className="h-6 border-b border-[#2a2a2a] bg-[#252525] flex items-center justify-center">
                    <button onClick={() => onAddTrack('video')} className="text-gray-500 hover:text-white" title="Add Video Track"><Plus className="w-3 h-3"/></button>
                </div>
                
                {/* Video Tracks */}
                {vTracks.map((track) => (
                    <div 
                        key={`v-${track.id}`} 
                        className="h-16 border-b border-[#2a2a2a] flex flex-col justify-center px-2 gap-1 relative group bg-[#232323]"
                        onContextMenu={(e) => handleContextMenu(e, null, track.id)}
                    >
                        <div className="flex items-center justify-between text-gray-400">
                            <div className="font-bold text-blue-400">{track.label}</div>
                            <div className="flex gap-1.5">
                                <button onClick={() => onUpdateTrack(track.id, { isLocked: !track.isLocked })}>
                                    <Lock className={`w-3 h-3 hover:text-white ${track.isLocked ? 'text-red-400 fill-current' : ''}`}/>
                                </button>
                                <button onClick={() => onUpdateTrack(track.id, { isHidden: !track.isHidden })}>
                                    {track.isHidden ? <EyeOff className="w-3 h-3 text-gray-600"/> : <Eye className="w-3 h-3 hover:text-white"/>}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                
                <div className="h-6 bg-[#121212] border-b border-[#2a2a2a] flex items-center justify-center border-t border-b border-[#333]">
                     {/* Divider / Spacer */}
                     <span className="text-[9px] text-gray-600">AUDIO</span>
                </div>

                {/* Audio Tracks */}
                {aTracks.map((track) => (
                    <div 
                        key={`a-${track.id}`} 
                        className="h-16 border-b border-[#2a2a2a] flex flex-col justify-center px-2 gap-1 relative group bg-[#232323]"
                        onContextMenu={(e) => handleContextMenu(e, null, track.id)}
                    >
                         <div className="flex items-center justify-between text-gray-400">
                            <div className="font-bold text-green-400">{track.label}</div>
                            <div className="flex gap-1.5">
                                <button onClick={() => onUpdateTrack(track.id, { isMuted: !track.isMuted })}>
                                     {track.isMuted ? <VolumeX className="w-3 h-3 text-red-500"/> : <Volume2 className="w-3 h-3 hover:text-white"/>}
                                </button>
                                <button title="Solo (Mock)">
                                    <Mic className="w-3 h-3 hover:text-yellow-500"/>
                                </button>
                                <button onClick={() => onUpdateTrack(track.id, { isLocked: !track.isLocked })}>
                                    <Lock className={`w-3 h-3 hover:text-white ${track.isLocked ? 'text-red-400 fill-current' : ''}`}/>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                <div className="h-6 border-b border-[#2a2a2a] bg-[#232323] flex items-center justify-center">
                    <button onClick={() => onAddTrack('audio')} className="text-gray-500 hover:text-white" title="Add Audio Track"><Plus className="w-3 h-3"/></button>
                </div>
            </div>
        )}

        {/* Scrollable Timeline Area */}
        <div 
            ref={scrollContainerRef}
            className={`flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar bg-[#161616] relative ${getCursor()}`} 
        >
          {isGraphView ? (
              // --- GRAPH EDITOR VIEW ---
              selectedLayer ? (
                  <GraphEditor 
                     layer={selectedLayer}
                     duration={duration}
                     currentTime={currentTime}
                     width={scrollContainerRef.current?.clientWidth || 1000}
                     height={300} 
                     onSeek={onSeek}
                     onUpdateKeyframe={(id, keys) => onUpdateLayer(id, { animations: keys })}
                  />
              ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
                      <Activity className="w-8 h-8 opacity-20"/>
                      <p>Select a clip to view its animation graph.</p>
                  </div>
              )
          ) : (
             // --- STANDARD TIMELINE VIEW ---
             <div 
                className="relative h-full" 
                style={{ width: `${totalWidth}px` }}
                onMouseDown={handleTimelineMouseDown}
             >
                {/* Time Ruler */}
                <div className="h-6 bg-[#1e1e1e] border-b border-[#2a2a2a] relative pointer-events-none w-full">
                    {ticks.map((tick, i) => (
                        <div key={i} className="absolute top-0 bottom-0 border-l border-[#333] pl-1 text-[9px] text-gray-500" style={{ left: `${tick.left}px` }}>
                            {tick.label}
                        </div>
                    ))}
                </div>

                {/* Playhead Line (Global) */}
                <div 
                    className="absolute top-0 bottom-0 w-px bg-blue-500 z-30 pointer-events-none"
                    style={{ left: `${currentTime * zoomLevel}px` }}
                >
                    <div className="absolute -top-0 -left-1.5 w-3 h-3 bg-blue-500 rotate-45 rounded-sm"></div>
                    <div className="absolute top-0 w-px h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                </div>

                {/* Video Clips Area */}
                <div className="relative">
                    {vTracks.map((track) => (
                        <div key={`v-content-${track.id}`} className={`h-16 border-b border-[#2a2a2a] relative w-full ${track.isLocked ? 'bg-[#1a1a1a] pattern-diagonal-lines' : 'bg-[#1a1a1a]/50'}`}>
                        {layers.filter(l => l.track === track.id).map((layer) => {
                            const left = layer.start * zoomLevel;
                            const width = layer.duration * zoomLevel;
                            const isSelected = selectedLayerId === layer.id;
                            const isBeingDragged = draggingId === layer.id;
                            
                            let bgColor = 'bg-violet-800/80 border-violet-600';
                            if (layer.type === 'text') bgColor = 'bg-pink-700/80 border-pink-500';
                            if (layer.type === 'image') bgColor = 'bg-purple-700/80 border-purple-500';
                            if (isSelected) bgColor = 'bg-gray-200 text-black border-white';

                            return (
                            <div
                                key={layer.id}
                                onMouseDown={(e) => !track.isLocked && handleLayerMouseDown(e, layer, 'MOVE')}
                                className={`absolute top-1 bottom-1 rounded-[2px] border cursor-pointer overflow-hidden group ${bgColor} ${isBeingDragged && dragMode === 'MOVE' ? 'opacity-80 z-50 shadow-lg' : 'z-10'} ${track.isHidden ? 'opacity-30' : ''}`}
                                style={{
                                    left: `${left}px`,
                                    width: `${width}px`,
                                    minWidth: '4px', // ensure visible even if tiny
                                    transition: isBeingDragged ? 'none' : 'top 0.1s'
                                }}
                            >
                                {/* Clip Content */}
                                <div className="px-1 py-0.5 text-[9px] font-medium truncate opacity-90 flex items-center gap-1 select-none pointer-events-none">
                                    <span className="opacity-50 font-mono">
                                        {formatTime(layer.srcStartTime || 0)}
                                    </span>
                                    {layer.label}
                                </div>
                                
                                {/* Resize Handles */}
                                {isSelected && activeTool === Tool.SELECTION && !track.isLocked && (
                                    <>
                                        <div 
                                            className="absolute left-0 top-0 bottom-0 w-3 hover:bg-white/40 cursor-w-resize z-50 flex items-center justify-center group/handle"
                                            onMouseDown={(e) => handleLayerMouseDown(e, layer, 'RESIZE_L')}
                                        >
                                            <div className="w-0.5 h-3 bg-black/20 group-hover/handle:bg-white"></div>
                                        </div>
                                        <div 
                                            className="absolute right-0 top-0 bottom-0 w-3 hover:bg-white/40 cursor-e-resize z-50 flex items-center justify-center group/handle"
                                            onMouseDown={(e) => handleLayerMouseDown(e, layer, 'RESIZE_R')}
                                        >
                                             <div className="w-0.5 h-3 bg-black/20 group-hover/handle:bg-white"></div>
                                        </div>
                                    </>
                                )}
                            </div>
                            );
                        })}
                        </div>
                    ))}
                </div>

                <div className="h-6 bg-[#121212] border-b border-[#2a2a2a]"></div>

                {/* Audio Area */}
                {aTracks.map((track) => (
                    <div key={`a-content-${track.id}`} className={`h-16 border-b border-[#2a2a2a] relative w-full ${track.isLocked ? 'bg-[#181818] opacity-50' : 'bg-[#181818]'}`}>
                        {layers.filter(l => l.track === track.id).map((layer) => {
                             const left = layer.start * zoomLevel;
                             const width = layer.duration * zoomLevel;
                             const isSelected = selectedLayerId === layer.id;
                             return (
                                <div
                                    key={layer.id}
                                    onMouseDown={(e) => !track.isLocked && handleLayerMouseDown(e, layer, 'MOVE')}
                                    className={`absolute top-1 bottom-1 rounded-[2px] border cursor-pointer overflow-hidden group bg-teal-800/80 border-teal-600 ${isSelected ? 'bg-gray-200 text-black border-white' : ''} z-10`}
                                    style={{
                                        left: `${left}px`,
                                        width: `${width}px`,
                                        minWidth: '4px'
                                    }}
                                >
                                     <div className="px-1 py-0.5 text-[9px] font-medium truncate opacity-90 flex items-center gap-1 select-none pointer-events-none">
                                        {layer.label}
                                     </div>
                                     {/* Simple Audio Waveform Sim */}
                                     <div className="absolute bottom-0 left-0 right-0 h-1/2 flex items-end opacity-30">
                                         <div className="w-full h-full bg-black/20" style={{ clipPath: 'polygon(0 50%, 10% 20%, 20% 80%, 30% 30%, 40% 70%, 50% 40%, 60% 60%, 70% 20%, 80% 80%, 90% 30%, 100% 50%, 100% 100%, 0 100%)'}}></div>
                                     </div>
                                </div>
                             )
                        })}
                    </div>
                ))}
                
                <div className="h-6 border-b border-[#2a2a2a] bg-[#232323]"></div>
             </div>
          )}
        </div>
      </div>

      {/* CONTEXT MENU */}
      {contextMenu.visible && (
          <div 
            className="fixed bg-[#2a2a2a] border border-[#444] shadow-xl rounded py-1 z-50 w-40"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
              {contextMenu.trackId !== undefined && contextMenu.trackId !== null ? (
                 <>
                    <button onClick={() => {
                        if (contextMenu.trackId !== null) onRemoveTrack(contextMenu.trackId);
                        setContextMenu(prev => ({...prev, visible: false}));
                    }} className="w-full text-left px-3 py-1.5 hover:bg-red-900 text-red-200 flex items-center gap-2">
                        <Trash2 className="w-3 h-3"/> Delete Track
                    </button>
                    <button onClick={() => {
                         const track = tracks.find(t => t.id === contextMenu.trackId);
                         if (track) {
                             const newName = prompt("Rename Track", track.label);
                             if (newName) onUpdateTrack(track.id, { label: newName });
                         }
                         setContextMenu(prev => ({...prev, visible: false}));
                    }} className="w-full text-left px-3 py-1.5 hover:bg-blue-600 text-gray-200 flex items-center gap-2">
                        <Edit2 className="w-3 h-3"/> Rename Track
                    </button>
                 </>
              ) : (
                 <>
                    <button onClick={() => { 
                        const newName = prompt("Rename Clip");
                        if (newName && contextMenu.layerId) onUpdateLayer(contextMenu.layerId, { label: newName });
                        setContextMenu(prev => ({...prev, visible: false}));
                    }} className="w-full text-left px-3 py-1.5 hover:bg-blue-600 text-gray-200 flex items-center gap-2">
                        <Edit2 className="w-3 h-3"/> Rename
                    </button>
                    
                    <button onClick={() => {
                        if(contextMenu.layerId) {
                                const layer = layers.find(l => l.id === contextMenu.layerId);
                                if(layer) onDuplicateLayer(layer.id, layer.start + 0.5, layer.track);
                        }
                        setContextMenu(prev => ({...prev, visible: false}));
                    }} className="w-full text-left px-3 py-1.5 hover:bg-blue-600 text-gray-200 flex items-center gap-2">
                        <Copy className="w-3 h-3"/> Duplicate
                    </button>
                    
                    <div className="h-px bg-[#444] my-1"></div>
                    
                    <button onClick={() => {
                        if (contextMenu.layerId) onDeleteLayer(contextMenu.layerId);
                        setContextMenu(prev => ({...prev, visible: false}));
                    }} className="w-full text-left px-3 py-1.5 hover:bg-red-900 text-red-200 flex items-center gap-2">
                        <Trash2 className="w-3 h-3"/> Delete
                    </button>
                 </>
              )}
          </div>
      )}
    </div>
  );
};