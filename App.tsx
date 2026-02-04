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
  const monitorRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const mediaImportRef = useRef<HTMLInputElement>(null);

  // --- Helper: Keyframe Interpolation with Easing ---
  const getInterpolatedValue = (layer: VideoSegment, propertyPath: string, defaultValue: number) => {
      // Find keyframes for this specific property
      const keyframes = layer.animations
          .filter(k => k.property === propertyPath)
          .sort((a, b) => a.time - b.time);

      if (keyframes.length === 0) return defaultValue;

      const localTime = state.currentTime - layer.start;

      // 1. Before first keyframe
      if (localTime <= keyframes[0].time) return keyframes[0].value;
      
      // 2. After last keyframe
      if (localTime >= keyframes[keyframes.length - 1].time) return keyframes[keyframes.length - 1].value;

      // 3. Between keyframes (Interpolate)
      const nextIndex = keyframes.findIndex(k => k.time > localTime);
      const nextKey = keyframes[nextIndex];
      const prevKey = keyframes[nextIndex - 1];

      const timeRange = nextKey.time - prevKey.time;
      const timeProgress = localTime - prevKey.time;
      let ratio = timeProgress / timeRange;

      // --- APPLY EASING (Easy Ease) ---
      const easingType = nextKey.easing || 'linear';
      switch (easingType) {
          case 'easeOut':
              ratio = 1 - Math.pow(1 - ratio, 3); // Cubic Ease Out
              break;
          case 'easeIn':
              ratio = ratio * ratio * ratio; // Cubic Ease In
              break;
          case 'bezier': // Simulating Ease In Out (Smoothstep/Bezier)
              // Simple sigmoid-like approx for "Easy Ease"
              ratio = ratio < 0.5 ? 2 * ratio * ratio : 1 - Math.pow(-2 * ratio + 2, 2) / 2;
              break;
          case 'step':
              ratio = 0; // Hold previous value
              break;
          case 'linear':
          default:
              // ratio remains linear
              break;
      }

      // Linear Interpolation (Lerp) with eased ratio
      return prevKey.value + (nextKey.value - prevKey.value) * ratio;
  };

  // --- Effects & Logic ---

  useEffect(() => {
    // Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

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
                if (state.selectedLayerId) handleDeleteLayer();
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
      if (newName) updateLayer(layer.id, { label: newName });
  };

  const handleDeleteLayer = (id?: string) => {
      const targetId = id || state.selectedLayerId;
      if (targetId) {
          setState(p => ({...p, layers: p.layers.filter(l => l.id !== targetId), selectedLayerId: null}));
      }
  };

  const handleDuplicateLayer = (id: string, newTime: number, newTrack: number) => {
      setState(prev => {
          const original = prev.layers.find(l => l.id === id);
          if (!original) return prev;
          
          const newLayer: VideoSegment = {
              ...original,
              id: `${original.id}-copy-${Date.now()}`,
              start: newTime,
              track: newTrack,
              label: `${original.label} Copy`
          };
          
          return {
              ...prev,
              layers: [...prev.layers, newLayer],
              selectedLayerId: newLayer.id
          };
      });
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
                    id: newId, type: 'video', track: 0, start: prev.currentTime, duration: videoElement.duration, label: file.name, src: url, speed: 1.0, transform: { ...DEFAULT_TRANSFORM }, anchorPoint: { x: 0.5, y: 0.5 }, opacity: 1, blendMode: 'normal', effects: [], animations: [], isActive: true, locked: false
                }]
            }));
        };
    } else {
        setState(prev => ({
            ...prev,
            layers: [...prev.layers, {
                id: newId, type: 'image', track: 1, start: prev.currentTime, duration: 5, label: file.name, src: url, speed: 1.0, transform: { ...DEFAULT_TRANSFORM }, anchorPoint: { x: 0.5, y: 0.5 }, opacity: 1, blendMode: 'normal', effects: [], animations: [], isActive: true, locked: false
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
              id: newId, type: 'text', track: 2, start: prev.currentTime, duration: 5, label: 'Text Layer', content: 'Lumina Title', speed: 1.0, style: { fontFamily: 'Inter', fontSize: 80, color: '#ffffff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }, transform: { ...DEFAULT_TRANSFORM }, anchorPoint: { x: 0.5, y: 0.5 }, opacity: 1, blendMode: 'normal', effects: [], animations: [], isActive: true, locked: false
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
          const firstPart = { ...layerToSplit, duration: splitRelative };
          const secondPart: VideoSegment = { ...layerToSplit, id: `${layerToSplit.id}-split-${Date.now()}`, start: time, duration: layerToSplit.duration - splitRelative };

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

  // --- AI TOOL EXECUTION ---
  const handleAIChat = async (msg: string) => {
      const userMsg: ChatMessage = { role: 'user', content: msg, timestamp: Date.now() };
      setState(prev => ({ ...prev, chatHistory: [...prev.chatHistory, userMsg], isProcessing: true }));
      
      try {
          const result = await chatWithAI([...state.chatHistory, userMsg], { filters: state.filters, duration: state.duration });
          
          // 1. Add AI Text Response
          const aiMsg: ChatMessage = { role: 'assistant', content: result.text, timestamp: Date.now(), sources: result.sources };
          
          let newLayers = [...state.layers];
          let newFilters = { ...state.filters };
          let sysMsg = "";

          // 2. Execute Tools
          if (result.toolCalls && result.toolCalls.length > 0) {
              for (const call of result.toolCalls) {
                  if (call.name === 'auto_cut_video') {
                      if (state.file) {
                        const pace = call.args?.pace || 'balanced';
                        try {
                            const cuts = await analyzeVideoForCuts(state.file, state.duration, pace);
                            // Populate source if missing from simulation
                            const processedCuts = cuts.map(c => ({...c, src: state.videoUrl || '' }));
                            // Replace current track 0 layers or append? Let's replace for "Auto-Cut"
                            newLayers = [...newLayers.filter(l => l.track !== 0), ...processedCuts];
                            sysMsg = "Auto-Cut applied successfully.";
                        } catch (e) {
                            sysMsg = "Failed to auto-cut video.";
                        }
                      } else {
                          sysMsg = "No video file loaded to cut.";
                      }
                  } else if (call.name === 'create_motion_graphic') {
                      const { text, style } = call.args;
                      const newId = `ai-text-${Date.now()}`;
                      const styleConfig: any = { fontFamily: 'Inter', fontSize: 100, color: 'white' };
                      if (style === 'cyberpunk') { styleConfig.color = '#00ffcc'; styleConfig.textShadow = '0 0 10px #00ffcc'; styleConfig.fontFamily = 'Oswald'; }
                      if (style === 'luxury') { styleConfig.color = '#ffd700'; styleConfig.fontFamily = 'Playfair Display'; }

                      newLayers.push({
                           id: newId, type: 'text', track: 2, start: state.currentTime, duration: 4, label: 'AI Graphic', content: text, speed: 1, 
                           style: styleConfig,
                           transform: { ...DEFAULT_TRANSFORM }, anchorPoint: { x: 0.5, y: 0.5 }, opacity: 1, blendMode: 'normal', effects: [], animations: [], isActive: true, locked: false
                      });
                      sysMsg = `Created ${style} graphic: "${text}"`;

                  } else if (call.name === 'apply_cinematic_grade') {
                      const { mood } = call.args;
                      if (mood === 'noir') newFilters = { ...DEFAULT_FILTERS, saturation: 0, contrast: 40, vignette: 50 };
                      if (mood === 'teal_orange') newFilters = { ...DEFAULT_FILTERS, temperature: -20, tint: -10, saturation: 120, contrast: 20 };
                      if (mood === 'matrix') newFilters = { ...DEFAULT_FILTERS, tint: -50, saturation: 80, contrast: 30 };
                      if (mood === 'warm') newFilters = { ...DEFAULT_FILTERS, temperature: 30, saturation: 110 };
                      sysMsg = `Applied ${mood} grading.`;
                  }
              }
          }

          if (sysMsg) {
             // Optional: Add a system feedback message to chat
             // aiMsg.content += `\n[System]: ${sysMsg}`;
          }

          setState(prev => ({ 
              ...prev, 
              chatHistory: [...prev.chatHistory, aiMsg], 
              isProcessing: false,
              layers: newLayers,
              filters: newFilters
          }));

      } catch (e) {
          console.error(e);
          setState(prev => ({ ...prev, isProcessing: false }));
      }
  };

  // --- PROGRAM MONITOR INTERACTION ---
  
  const handleOverlayMouseDown = (e: React.MouseEvent, layer: VideoSegment, type: 'move' | 'resize') => {
      e.stopPropagation(); // Stop bubbling to container
      
      if(state.selectedLayerId !== layer.id) {
          setState(p => ({...p, selectedLayerId: layer.id, activePanel: PanelType.EFFECT_CONTROLS}));
      }

      const startX = e.clientX;
      const startY = e.clientY;
      
      // Get current effective values (considering keyframes)
      const currentScale = getInterpolatedValue(layer, 'transform.scale', layer.transform.scale);
      const currentX = getInterpolatedValue(layer, 'transform.translateX', layer.transform.translateX);
      const currentY = getInterpolatedValue(layer, 'transform.translateY', layer.transform.translateY);

      const hasKeyframes = (prop: string) => layer.animations.some(k => k.property === prop);

      const handleMouseMove = (ev: MouseEvent) => {
          ev.preventDefault();
          const deltaX = ev.clientX - startX;
          const deltaY = ev.clientY - startY;

          if (type === 'move') {
              const newX = currentX + deltaX;
              const newY = currentY + deltaY;
              
              if (hasKeyframes('transform.translateX') || hasKeyframes('transform.translateY')) {
                  const localTime = state.currentTime - layer.start;
                  // Complex: Need to update both independently if one is keyed
                  const newKeys = layer.animations.filter(k => 
                      !['transform.translateX', 'transform.translateY'].includes(k.property) || Math.abs(k.time - localTime) > 0.05
                  );
                  newKeys.push(
                      { property: 'transform.translateX', time: localTime, value: newX, easing: 'linear' as const },
                      { property: 'transform.translateY', time: localTime, value: newY, easing: 'linear' as const }
                  );
                  updateLayer(layer.id, { animations: newKeys });
              } else {
                   updateLayer(layer.id, {
                      transform: { ...layer.transform, translateX: newX, translateY: newY }
                  });
              }

          } else if (type === 'resize') {
              const sensitivity = 0.5;
              const newScale = Math.max(0, currentScale + (deltaX * sensitivity));
              
              if (hasKeyframes('transform.scale')) {
                  const localTime = state.currentTime - layer.start;
                  const newKeys = [...layer.animations.filter(k => k.property !== 'transform.scale' || Math.abs(k.time - localTime) > 0.05), {
                      property: 'transform.scale',
                      time: localTime,
                      value: newScale,
                      easing: 'linear' as const
                  }];
                  updateLayer(layer.id, { animations: newKeys });
              } else {
                   updateLayer(layer.id, {
                      transform: { ...layer.transform, scale: newScale }
                  });
              }
          }
      };

      const handleMouseUp = () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
  };

  // --- Rendering Composition ---
  const renderOverlays = () => {
      return state.layers
        .filter(l => l.isActive && l.track > 0)
        .filter(l => state.currentTime >= l.start && state.currentTime <= (l.start + l.duration))
        .map(layer => {
            const isSelected = state.selectedLayerId === layer.id;
            
            // CALCULATE INTERPOLATED VALUES
            const scale = getInterpolatedValue(layer, 'transform.scale', layer.transform.scale) / 100;
            const x = getInterpolatedValue(layer, 'transform.translateX', layer.transform.translateX);
            const y = getInterpolatedValue(layer, 'transform.translateY', layer.transform.translateY);
            const rot = getInterpolatedValue(layer, 'transform.rotateZ', layer.transform.rotateZ);
            const opacity = getInterpolatedValue(layer, 'opacity', layer.opacity);

            // New Effects Properties
            const skewX = getInterpolatedValue(layer, 'transform.skewX', 0);
            const skewY = getInterpolatedValue(layer, 'transform.skewY', 0);
            const blurAmount = getInterpolatedValue(layer, 'effects.blur', 0);
            const wipeProgress = getInterpolatedValue(layer, 'effects.wipe', 0);
            const textProgress = getInterpolatedValue(layer, 'text.progress', 100);

            // Calculate Filters
            let filterString = '';
            if (blurAmount > 0) filterString += `blur(${blurAmount}px) `;

            // Calculate Clip Path (Linear Wipe)
            // Wipe from 0 to 100. 0 = Full Visible, 100 = Hidden (or vice versa depending on preset)
            // Implementation: Wipe Left to Right
            // inset(0 0 0 0) is visible. inset(0 100% 0 0) is hidden from right.
            let clipPathString = '';
            if (wipeProgress > 0) {
                clipPathString = `inset(0 ${Math.min(100, wipeProgress)}% 0 0)`;
            }

            // Base style for content
            const style: React.CSSProperties = {
                transform: `
                    translate3d(${x}px, ${y}px, 0)
                    rotateZ(${rot}deg)
                    scale(${scale})
                    skew(${skewX}deg, ${skewY}deg)
                `,
                opacity: opacity,
                position: 'absolute',
                top: '50%', left: '50%',
                marginTop: '-50px', marginLeft: '-100px', // Center origin logic
                mixBlendMode: layer.blendMode,
                pointerEvents: 'auto', // Ensure it captures clicks
                userSelect: 'none',
                transformOrigin: '50% 50%',
                filter: filterString,
                clipPath: clipPathString,
                transition: 'none' // We manually interpolate, disable CSS transitions to avoid conflicts
            };

            const Content = () => {
                if (layer.type === 'image' && layer.src) {
                    return <img src={layer.src} alt="" className="max-w-[400px] object-contain pointer-events-none select-none" draggable={false} />;
                }
                if (layer.type === 'text' && layer.content) {
                    // Typewriter Effect Logic
                    let displayContent = layer.content;
                    if (textProgress < 100) {
                        const len = Math.floor(layer.content.length * (Math.max(0, textProgress) / 100));
                        displayContent = layer.content.substring(0, len);
                    }

                    return (
                        <div style={{
                            fontFamily: layer.style?.fontFamily,
                            fontSize: `${layer.style?.fontSize}px`,
                            color: layer.style?.color,
                            textShadow: layer.style?.textShadow,
                            whiteSpace: 'nowrap',
                            fontWeight: 700,
                            cursor: 'move'
                        }}>
                            {displayContent}
                            {/* Cursor Blinker for Typewriter */}
                            {textProgress < 100 && textProgress > 0 && (
                                <span className="animate-pulse border-r-2 border-white ml-0.5 h-full inline-block align-middle">&nbsp;</span>
                            )}
                        </div>
                    );
                }
                return null;
            };

            return (
                <div key={layer.id} style={style} 
                     onMouseDown={(e) => handleOverlayMouseDown(e, layer, 'move')}
                     className={`group ${isSelected ? 'z-50' : 'z-10'}`}>
                    
                    <Content />

                    {/* Transform Controls (Gizmo) */}
                    {isSelected && (
                        <div className="absolute -inset-2 border-2 border-blue-500 pointer-events-none">
                            {/* Resize Handle - Bottom Right */}
                            <div 
                                className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-blue-500 border-2 border-white cursor-nwse-resize pointer-events-auto"
                                onMouseDown={(e) => handleOverlayMouseDown(e, layer, 'resize')}
                            />
                            {/* Visual Corners (Visual Only) */}
                            <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-blue-500 border border-white"/>
                            <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-500 border border-white"/>
                            <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-blue-500 border border-white"/>
                        </div>
                    )}
                </div>
            );
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
        <input type="file" ref={projectInputRef} onChange={handleLoadProject} accept=".lumina,.json" className="hidden" />
        <input type="file" ref={mediaImportRef} onChange={(e) => handleImport(e)} accept="video/*,image/*" className="hidden" />

        {state.showExportModal && (
            <ExportModal onClose={() => setState(p => ({...p, showExportModal: false}))} onExport={() => { alert('Rendering Sequence...'); setState(p => ({...p, showExportModal: false})); }} />
        )}

        <TopMenu 
            onImport={() => mediaImportRef.current?.click()}
            onSave={handleSaveProject}
            onOpen={() => projectInputRef.current?.click()}
            onExport={() => setState(p => ({...p, showExportModal: true}))}
            onUndo={() => {}} onRedo={() => {}}
            onDelete={() => handleDeleteLayer()}
            onRenameLayer={handleRenameLayer}
            activePanel={state.activePanel}
            setActivePanel={(p) => setState(s => ({...s, activePanel: p}))}
        />

        <div className="flex-1 flex min-h-0">
            <div className="w-[35%] flex flex-col border-r border-[#121212]">
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
                        currentTime={state.currentTime}
                    />
                </div>
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

            <div className="flex-1 flex flex-col min-w-0">
                <div className="h-[55%] bg-[#0a0a0a] border-b border-[#121212] flex flex-col relative group">
                     <div className="absolute inset-8 border border-white/10 pointer-events-none z-10"></div>
                     <div className="absolute inset-16 border border-white/10 pointer-events-none z-10"></div>

                     <div className="flex-1 flex items-center justify-center overflow-hidden bg-black relative" ref={monitorRef}>
                        {state.videoUrl ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                                <video 
                                    ref={videoRef}
                                    src={state.videoUrl}
                                    className="max-w-full max-h-full pointer-events-none" // Disable Pointer events on video to allow Overlay clicks
                                    style={{ filter: filterStyle }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
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

                <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">
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
                            onUpdateLayer={updateLayer}
                            onDuplicateLayer={handleDuplicateLayer}
                            onDeleteLayer={handleDeleteLayer}
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