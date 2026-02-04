import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, Maximize2, Monitor } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Timeline } from './components/Timeline';
import { ToolsBar } from './components/ToolsBar';
import { ExportModal } from './components/ExportModal';
import { TopMenu } from './components/TopMenu';
import { EditingState, PanelType, DEFAULT_FILTERS, VideoSegment, DEFAULT_TRANSFORM, Tool, LayerType, ChatMessage, AnimationKeyframe, ProjectFile, LuminaPreset } from './types';
import { chatWithAI, analyzeVideoForCuts } from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<EditingState>({
    file: null,
    videoUrl: null,
    duration: 0,
    currentTime: 0,
    isPlaying: false,
    layers: [],
    selectedLayerId: null,
    filters: DEFAULT_FILTERS,
    isProcessing: false,
    chatHistory: [],
    activeTool: Tool.SELECTION,
    activePanel: PanelType.PROJECT,
    showExportModal: false,
    preferences: {
        theme: 'dark',
        autoSave: true,
        timelineSnap: true
    }
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const mediaImportRef = useRef<HTMLInputElement>(null);

  // --- Effects & Logic ---

  useEffect(() => {
    // Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
        // Prevent shortcuts if typing in input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        // Save Shortcut (Ctrl+S)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleSaveProject();
            return;
        }

        switch(e.key.toLowerCase()) {
            case ' ': e.preventDefault(); togglePlay(); break;
            case 'v': setState(p => ({...p, activeTool: Tool.SELECTION})); break;
            case 'c': setState(p => ({...p, activeTool: Tool.RAZOR})); break;
            case 'b': setState(p => ({...p, activeTool: Tool.RIPPLE_EDIT})); break;
            case 'n': setState(p => ({...p, activeTool: Tool.ROLLING_EDIT})); break;
            case 'r': setState(p => ({...p, activeTool: Tool.RATE_STRETCH})); break;
            case 'a': setState(p => ({...p, activeTool: Tool.TRACK_SELECT_FWD})); break;
            case 'delete': 
                if (state.selectedLayerId) {
                    handleDeleteLayer();
                }
                break;
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedLayerId, state.layers, state.filters]);

  const updateTime = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      setState(prev => ({ ...prev, currentTime: t }));
      if (t >= state.duration) setState(prev => ({ ...prev, isPlaying: false }));
      else animationFrameRef.current = requestAnimationFrame(updateTime);
    }
  };

  useEffect(() => {
    if (state.isPlaying) {
      if (videoRef.current) videoRef.current.play();
      animationFrameRef.current = requestAnimationFrame(updateTime);
    } else {
      if (videoRef.current) videoRef.current.pause();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [state.isPlaying]);

  // --- Actions ---

  const handleSaveProject = () => {
      const projectData: ProjectFile = {
          version: "1.0.0",
          name: "Lumina Sequence 01",
          date: new Date().toISOString(),
          duration: state.duration,
          filters: state.filters,
          layers: state.layers
      };

      const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lumina_project_${Date.now()}.lumina`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const projectData: ProjectFile = JSON.parse(event.target?.result as string);
              if (!projectData.layers || !projectData.version) throw new Error("Invalid Project File");

              setState(prev => ({
                  ...prev,
                  duration: projectData.duration || prev.duration,
                  filters: projectData.filters || DEFAULT_FILTERS,
                  layers: projectData.layers.map(l => ({...l, isActive: true})),
                  selectedLayerId: null,
                  activePanel: PanelType.PROJECT
              }));
              alert("Project Loaded Successfully!");
          } catch (err) {
              console.error(err);
              alert("Failed to load project file.");
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const handleRenameLayer = () => {
      if (!state.selectedLayerId) return;
      const layer = state.layers.find(l => l.id === state.selectedLayerId);
      if (!layer) return;

      const newName = prompt("Rename Clip", layer.label);
      if (newName) {
          updateLayer(layer.id, { label: newName });
      }
  };

  const handleDeleteLayer = () => {
      if (state.selectedLayerId) {
          setState(p => ({...p, layers: p.layers.filter(l => l.id !== p.selectedLayerId), selectedLayerId: null}));
      }
  };

  const handleApplyPreset = (preset: LuminaPreset) => {
      if (preset.targetType === 'global') {
          if (preset.data.filters) {
              setState(p => ({ ...p, filters: { ...p.filters, ...preset.data.filters } }));
          }
      } else {
          if (!state.selectedLayerId) {
              alert("Please select a layer to apply this preset.");
              return;
          }
          setState(prev => {
              const layer = prev.layers.find(l => l.id === prev.selectedLayerId);
              if (!layer) return prev;

              if (preset.targetType !== layer.type && preset.targetType !== 'video') { 
                   if(preset.targetType === 'text' && layer.type !== 'text') return prev;
              }

              const updatedLayer = { ...layer };
              if (preset.data.transform) updatedLayer.transform = { ...updatedLayer.transform, ...preset.data.transform };
              if (preset.data.style && layer.type === 'text') updatedLayer.style = { ...updatedLayer.style, ...preset.data.style };

              return {
                  ...prev,
                  layers: prev.layers.map(l => l.id === prev.selectedLayerId ? updatedLayer : l)
              };
          });
      }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'image' = 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const newId = `layer-${Date.now()}`;
    
    // Auto-detect type if coming from generic input
    const isImage = file.type.startsWith('image/');
    const finalType = isImage ? 'image' : 'video';

    if (finalType === 'video') {
        const videoElement = document.createElement('video');
        videoElement.src = url;
        videoElement.onloadedmetadata = () => {
             setState(prev => ({
                ...prev,
                file,
                videoUrl: url,
                duration: Math.max(prev.duration, videoElement.duration),
                layers: [...prev.layers, {
                    id: newId,
                    type: 'video',
                    track: 0,
                    start: prev.currentTime,
                    duration: videoElement.duration,
                    label: file.name,
                    src: url,
                    speed: 1.0,
                    transform: { ...DEFAULT_TRANSFORM },
                    anchorPoint: { x: 0.5, y: 0.5 },
                    opacity: 1,
                    blendMode: 'normal',
                    effects: [],
                    animations: [],
                    isActive: true,
                    locked: false
                }]
            }));
        };
    } else {
        setState(prev => ({
            ...prev,
            layers: [...prev.layers, {
                id: newId,
                type: 'image',
                track: 1,
                start: prev.currentTime,
                duration: 5,
                label: file.name,
                src: url,
                speed: 1.0,
                transform: { ...DEFAULT_TRANSFORM },
                anchorPoint: { x: 0.5, y: 0.5 },
                opacity: 1,
                blendMode: 'normal',
                effects: [],
                animations: [],
                isActive: true,
                locked: false
            }],
            selectedLayerId: newId,
            activePanel: PanelType.EFFECT_CONTROLS
        }));
    }
    e.target.value = '';
  };

  const handleAddText = () => {
      const newId = `txt-${Date.now()}`;
      setState(prev => ({
          ...prev,
          layers: [...prev.layers, {
              id: newId,
              type: 'text',
              track: 2,
              start: prev.currentTime,
              duration: 5,
              label: 'Text Layer',
              content: 'Lumina Title',
              speed: 1.0,
              style: { fontFamily: 'Inter', fontSize: 80, color: '#ffffff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' },
              transform: { ...DEFAULT_TRANSFORM },
              anchorPoint: { x: 0.5, y: 0.5 },
              opacity: 1,
              blendMode: 'normal',
              effects: [],
              animations: [],
              isActive: true,
              locked: false
          }],
          selectedLayerId: newId,
          activePanel: PanelType.ESSENTIAL_GRAPHICS
      }));
  };

  const handleRazor = (time: number, layerId: string) => {
      setState(prev => {
          const layerToSplit = prev.layers.find(l => l.id === layerId);
          if (!layerToSplit) return prev;
          if (time <= layerToSplit.start || time >= (layerToSplit.start + layerToSplit.duration)) return prev;

          const splitRelative = time - layerToSplit.start;
          
          const firstPart = {
              ...layerToSplit,
              duration: splitRelative
          };

          const secondPart: VideoSegment = {
              ...layerToSplit,
              id: `${layerToSplit.id}-split-${Date.now()}`,
              start: time,
              duration: layerToSplit.duration - splitRelative,
          };

          return {
              ...prev,
              layers: prev.layers.map(l => l.id === layerId ? firstPart : l).concat(secondPart),
              selectedLayerId: secondPart.id
          };
      });
  };

  const togglePlay = () => setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));

  const updateLayer = (id: string, updates: Partial<VideoSegment>) => {
      setState(prev => ({
          ...prev,
          layers: prev.layers.map(l => l.id === id ? { ...l, ...updates } : l)
      }));
  };

  const handleAIChat = async (msg: string) => {
      const userMsg: ChatMessage = { role: 'user', content: msg, timestamp: Date.now() };
      
      setState(prev => ({
          ...prev,
          chatHistory: [...prev.chatHistory, userMsg],
          isProcessing: true
      }));

      const historyForAI = [...state.chatHistory, userMsg];

      try {
          const result = await chatWithAI(historyForAI, { filters: state.filters, duration: state.duration });
          
          const aiMsg: ChatMessage = {
              role: 'assistant',
              content: result.text,
              timestamp: Date.now(),
              sources: result.sources
          };

          setState(prev => ({
              ...prev,
              chatHistory: [...prev.chatHistory, aiMsg],
              isProcessing: false
          }));
      } catch (e) {
          console.error(e);
          setState(prev => ({ ...prev, isProcessing: false }));
      }
  };

  // --- Rendering Compositon ---
  const renderOverlays = () => {
      return state.layers
        .filter(l => l.isActive && l.track > 0)
        .filter(l => state.currentTime >= l.start && state.currentTime <= (l.start + l.duration))
        .map(layer => {
            const scale = layer.transform.scale / 100;
            const style: React.CSSProperties = {
                transform: `
                    translate3d(${layer.transform.translateX}px, ${layer.transform.translateY}px, 0)
                    rotateZ(${layer.transform.rotateZ}deg)
                    scale(${scale})
                `,
                opacity: layer.opacity,
                position: 'absolute',
                top: '50%', left: '50%',
                marginTop: '-50px', marginLeft: '-100px',
                mixBlendMode: layer.blendMode,
                pointerEvents: 'none',
            };

            if (layer.type === 'image' && layer.src) {
                return <img key={layer.id} src={layer.src} alt="" className="max-w-[400px] object-contain" style={style} />;
            }
            if (layer.type === 'text' && layer.content) {
                return (
                    <div key={layer.id} style={{
                        ...style,
                        fontFamily: layer.style?.fontFamily,
                        fontSize: `${layer.style?.fontSize}px`,
                        color: layer.style?.color,
                        textShadow: layer.style?.textShadow,
                        whiteSpace: 'nowrap',
                        fontWeight: 700
                    }}>
                        {layer.content}
                    </div>
                );
            }
            return null;
        });
  };

  const filterStyle = `
    brightness(${100 + state.filters.exposure * 10}%)
    contrast(${100 + state.filters.contrast}%)
    saturate(${state.filters.saturation}%)
    sepia(${state.filters.temperature > 0 ? state.filters.temperature/2 : 0}%)
    hue-rotate(${state.filters.tint}deg)
    grayscale(${state.filters.saturation === 0 ? 100 : 0}%)
  `;

  return (
    <div className="flex flex-col h-screen bg-[#121212] text-gray-200 overflow-hidden font-sans select-none">
        {/* Hidden Inputs */}
        <input 
            type="file" 
            ref={projectInputRef} 
            onChange={handleLoadProject} 
            accept=".lumina,.json" 
            className="hidden" 
        />
        <input 
            type="file"
            ref={mediaImportRef}
            onChange={(e) => handleImport(e)}
            accept="video/*,image/*"
            className="hidden"
        />

        {/* Export Modal */}
        {state.showExportModal && (
            <ExportModal 
                onClose={() => setState(p => ({...p, showExportModal: false}))} 
                onExport={() => { alert('Rendering Sequence...'); setState(p => ({...p, showExportModal: false})); }}
            />
        )}

        {/* Header / Menu Bar */}
        <TopMenu 
            onImport={() => mediaImportRef.current?.click()}
            onSave={handleSaveProject}
            onOpen={() => projectInputRef.current?.click()}
            onExport={() => setState(p => ({...p, showExportModal: true}))}
            onUndo={() => console.log('Undo not implemented')}
            onRedo={() => console.log('Redo not implemented')}
            onDelete={handleDeleteLayer}
            onRenameLayer={handleRenameLayer}
            activePanel={state.activePanel}
            setActivePanel={(p) => setState(s => ({...s, activePanel: p}))}
        />

        {/* Workspace Grid */}
        <div className="flex-1 flex min-h-0">
            
            {/* Left Column (Source / Panels) */}
            <div className="w-[35%] flex flex-col border-r border-[#121212]">
                {/* Top Left: Source Monitor (Placeholder) / Effect Controls */}
                <div className="h-[50%] bg-[#1e1e1e] border-b border-[#121212] flex flex-col">
                    <Sidebar 
                        activePanel={state.activePanel} 
                        setActivePanel={(p) => setState(s => ({...s, activePanel: p}))}
                        filters={state.filters}
                        setFilters={(f) => setState(s => ({...s, filters: f}))}
                        selectedLayer={state.layers.find(l => l.id === state.selectedLayerId)}
                        updateLayer={updateLayer}
                        onAIChat={handleAIChat}
                        isProcessing={state.isProcessing}
                        chatHistory={state.chatHistory}
                        onAddText={handleAddText}
                        layers={state.layers}
                        onApplyPreset={handleApplyPreset}
                    />
                </div>

                {/* Bottom Left: Project Assets */}
                <div className="flex-1 bg-[#1e1e1e] p-2 overflow-y-auto">
                    <div className="text-[11px] text-gray-400 font-bold mb-2 flex justify-between">
                         <span>Project: Media Browser</span>
                         <span className="text-gray-600">Writable</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        <label className="aspect-square bg-[#232323] border border-[#333] hover:border-gray-500 rounded flex flex-col items-center justify-center cursor-pointer">
                            <Upload className="w-5 h-5 text-gray-500"/>
                            <span className="text-[9px] mt-1 text-gray-400">Import</span>
                            <input type="file" onChange={(e) => handleImport(e, 'video')} className="hidden" accept="video/*"/>
                        </label>
                    </div>
                </div>
            </div>

            {/* Right Column (Program / Timeline) */}
            <div className="flex-1 flex flex-col min-w-0">
                
                {/* Top Right: Program Monitor */}
                <div className="h-[55%] bg-[#0a0a0a] border-b border-[#121212] flex flex-col relative group">
                     {/* Safe Margins Overlay */}
                     <div className="absolute inset-8 border border-white/10 pointer-events-none z-10"></div>
                     <div className="absolute inset-16 border border-white/10 pointer-events-none z-10"></div>

                     <div className="flex-1 flex items-center justify-center overflow-hidden bg-black relative">
                        {state.videoUrl ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                                <video 
                                    ref={videoRef}
                                    src={state.videoUrl}
                                    className="max-w-full max-h-full"
                                    style={{ filter: filterStyle }}
                                />
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                    {renderOverlays()}
                                </div>
                            </div>
                        ) : (
                            <div className="text-gray-600 flex flex-col items-center">
                                <Monitor className="w-12 h-12 mb-2 opacity-20"/>
                                <span>Program Monitor</span>
                            </div>
                        )}
                     </div>

                     {/* Transport Controls */}
                     <div className="h-10 bg-[#1e1e1e] flex items-center justify-between px-4 border-t border-[#2a2a2a]">
                         <div className="text-blue-400 font-mono text-sm">{state.currentTime.toFixed(2)}</div>
                         <div className="flex gap-4 text-gray-400">
                             <button onClick={() => setState(s => ({...s, currentTime: 0}))} className="hover:text-white">|&lt;</button>
                             <button onClick={togglePlay} className="hover:text-white text-white">
                                {state.isPlaying ? <Pause className="w-4 h-4 fill-current"/> : <Play className="w-4 h-4 fill-current"/>}
                             </button>
                             <button className="hover:text-white">&gt;|</button>
                         </div>
                         <div className="flex gap-2">
                             <Maximize2 className="w-4 h-4 text-gray-500 hover:text-white cursor-pointer"/>
                         </div>
                     </div>
                </div>

                {/* Bottom Right: Timeline */}
                <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">
                     {/* Timeline Tools Stripe */}
                     <div className="h-8 bg-[#232323] border-b border-[#121212] flex items-center px-2 text-[10px] gap-2 text-gray-400">
                         <span className="text-blue-400 font-bold">Sequence 01</span>
                         <span className="w-px h-4 bg-gray-700 mx-2"></span>
                         <span>{state.activeTool}</span>
                     </div>
                     
                     <div className="flex-1 flex overflow-hidden">
                        <ToolsBar activeTool={state.activeTool} setTool={(t) => setState(s => ({...s, activeTool: t}))} />
                        <Timeline 
                            duration={state.duration || 60}
                            currentTime={state.currentTime}
                            layers={state.layers}
                            selectedLayerId={state.selectedLayerId}
                            onSeek={(t) => {
                                if (videoRef.current) videoRef.current.currentTime = t;
                                setState(s => ({...s, currentTime: t}));
                            }}
                            onSelectLayer={(id) => setState(s => ({...s, selectedLayerId: id, activePanel: PanelType.EFFECT_CONTROLS}))}
                            onRazor={handleRazor}
                            activeTool={state.activeTool}
                        />
                     </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default App;