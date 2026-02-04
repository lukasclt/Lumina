import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, Download, Settings, FileImage, FileVideo, Video } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Timeline } from './components/Timeline';
import { ToolsBar } from './components/ToolsBar';
import { EditingState, Tab, DEFAULT_FILTERS, VideoSegment, DEFAULT_TRANSFORM, Tool, LayerType, ChatMessage, AnimationKeyframe } from './types';
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
    preferences: {
        theme: 'dark',
        autoSave: true,
        timelineSnap: true
    },
    showPreferences: false
  });

  const [activeTab, setActiveTab] = useState<Tab>(Tab.PROJECT);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const savedHistory = localStorage.getItem('lumina_chat_history');
    if (savedHistory) {
        try {
            const parsed = JSON.parse(savedHistory);
            setState(prev => ({ ...prev, chatHistory: parsed }));
        } catch (e) { console.error("Failed to load chat history", e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('lumina_chat_history', JSON.stringify(state.chatHistory));
  }, [state.chatHistory]);

  const updateTime = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      setState(prev => ({ ...prev, currentTime: t }));
      
      if (t >= state.duration) {
          setState(prev => ({ ...prev, isPlaying: false }));
      } else {
          animationFrameRef.current = requestAnimationFrame(updateTime);
      }
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
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [state.isPlaying]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'image') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);

    if (type === 'video') {
        setState(prev => ({
            ...prev,
            file,
            videoUrl: url,
            currentTime: 0,
            isPlaying: false,
            layers: [{
                id: `main-${Date.now()}`,
                type: 'video',
                track: 0,
                start: 0,
                duration: 0,
                label: file.name,
                src: url,
                transform: DEFAULT_TRANSFORM,
                opacity: 1,
                animations: [],
                isActive: true
            }],
            filters: DEFAULT_FILTERS
        }));
    } else if (type === 'image') {
        const newLayer: VideoSegment = {
            id: `img-${Date.now()}`,
            type: 'image',
            track: 1,
            start: state.currentTime,
            duration: 5,
            label: file.name,
            src: url,
            transform: DEFAULT_TRANSFORM,
            opacity: 1,
            animations: [],
            isActive: true
        };
        setState(prev => ({
            ...prev,
            layers: [...prev.layers, newLayer],
            selectedLayerId: newLayer.id,
            activeTab: Tab.EFFECTS
        }));
    }
  };

  const handleAddText = () => {
      const newLayer: VideoSegment = {
          id: `txt-${Date.now()}`,
          type: 'text',
          track: 2,
          start: state.currentTime,
          duration: 5,
          label: 'Text Layer',
          content: 'Lumina Text',
          style: {
              fontFamily: 'Inter',
              fontSize: 60,
              color: '#ffffff',
              textShadow: '0 4px 6px rgba(0,0,0,0.5)'
          },
          transform: DEFAULT_TRANSFORM,
          opacity: 1,
          animations: [],
          isActive: true
      };
      setState(prev => ({
          ...prev,
          layers: [...prev.layers, newLayer],
          selectedLayerId: newLayer.id,
          activeTab: Tab.TEXT
      }));
  };

  const handleMetadataLoaded = () => {
    if (videoRef.current) {
        const d = videoRef.current.duration;
        setState(prev => ({ 
            ...prev, 
            duration: d,
            layers: prev.layers.map(l => l.track === 0 ? { ...l, duration: d } : l)
        }));
    }
  };

  const togglePlay = () => setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setState(prev => ({ ...prev, currentTime: time }));
    }
  };

  const updateLayer = (id: string, updates: Partial<VideoSegment>) => {
      setState(prev => ({
          ...prev,
          layers: prev.layers.map(l => l.id === id ? { ...l, ...updates } : l)
      }));
  };

  // --- AI Agent Handler ---
  const handleAIChat = async (msg: string) => {
    const userMsg: ChatMessage = { role: 'user', content: msg, timestamp: Date.now() };
    setState(prev => ({ 
        ...prev, 
        chatHistory: [...prev.chatHistory, userMsg],
        isProcessing: true 
    }));

    try {
      const result = await chatWithAI(
          [...state.chatHistory, userMsg], 
          { filters: state.filters, duration: state.duration }
      );

      // Execute Tool Calls
      if (result.toolCalls && result.toolCalls.length > 0) {
        for (const tool of result.toolCalls) {
            
            // 1. Auto Cut Video
            if (tool.name === "auto_cut_video" && state.file) {
                const segments = await analyzeVideoForCuts(state.file, state.duration);
                if (segments.length > 0) {
                     setState(prev => ({
                        ...prev,
                        layers: [
                            ...segments, // New Video segments
                            ...prev.layers.filter(l => l.track !== 0) // Keep other layers
                        ]
                     }));
                }
            }

            // 2. Motion Graphics (Agent Design)
            if (tool.name === "create_motion_graphic") {
                const { text, style, position } = tool.args;
                
                // Construct Animation Keyframes based on Style
                const animations: AnimationKeyframe[] = [];
                let startScale = 1;
                let startY = 0;
                let opacityStart = 0;
                let transform = { ...DEFAULT_TRANSFORM };
                let textColor = '#ffffff';
                let textShadow = '0 2px 10px rgba(0,0,0,0.5)';

                if (style === "cyberpunk_neon") {
                    textColor = '#00ffcc';
                    textShadow = '0 0 10px #00ffcc, 0 0 20px #00ffcc, 0 0 40px #00ffcc';
                    animations.push({ property: 'scale', startValue: 0.8, endValue: 1.2, startTime: 0, duration: 0.5, easing: 'elastic' });
                    animations.push({ property: 'opacity', startValue: 0, endValue: 1, startTime: 0, duration: 0.3, easing: 'linear' });
                } else if (style === "minimal_fade") {
                    transform.translateY = 50;
                    animations.push({ property: 'translateY', startValue: 50, endValue: 0, startTime: 0, duration: 1.5, easing: 'easeOut' });
                    animations.push({ property: 'opacity', startValue: 0, endValue: 1, startTime: 0, duration: 1.5, easing: 'linear' });
                } else if (style === "kinetic_typography") {
                     transform.scale = 3;
                     animations.push({ property: 'scale', startValue: 3, endValue: 1, startTime: 0, duration: 0.4, easing: 'easeOut' });
                     animations.push({ property: 'rotateZ', startValue: -15, endValue: 0, startTime: 0, duration: 0.5, easing: 'elastic' });
                } else if (style === "3d_tumble") {
                     transform.rotateX = 90;
                     animations.push({ property: 'rotateX', startValue: 90, endValue: 0, startTime: 0, duration: 1, easing: 'easeOut' });
                }

                // Position Logic
                if (position === "bottom_thirds") transform.translateY = 300;
                if (position === "top_header") transform.translateY = -300;

                const newLayer: VideoSegment = {
                    id: `ai-motion-${Date.now()}`,
                    type: 'text',
                    track: 2,
                    start: state.currentTime,
                    duration: 4,
                    label: `AI: ${text}`,
                    content: text,
                    style: {
                        fontFamily: 'Montserrat',
                        fontSize: 80,
                        color: textColor,
                        textShadow: textShadow,
                    },
                    transform: transform,
                    opacity: 1,
                    animations: animations,
                    isActive: true
                };
                setState(prev => ({ ...prev, layers: [...prev.layers, newLayer] }));
            }

            // 3. Color Grading
            if (tool.name === "apply_cinematic_grade") {
                const { mood } = tool.args;
                let newFilters = { ...DEFAULT_FILTERS };
                if (mood === "dramatic_noir") newFilters = { ...DEFAULT_FILTERS, grayscale: 100, contrast: 130, brightness: 90 };
                if (mood === "vibrant_vlog") newFilters = { ...DEFAULT_FILTERS, saturate: 150, contrast: 110, brightness: 105 };
                if (mood === "vintage_film") newFilters = { ...DEFAULT_FILTERS, sepia: 60, contrast: 90, blur: 0.5 };
                if (mood === "matrix_green") newFilters = { ...DEFAULT_FILTERS, hueRotate: 90, contrast: 120, saturate: 80 };
                if (mood === "warm_sunset") newFilters = { ...DEFAULT_FILTERS, sepia: 30, hueRotate: -10, saturate: 120 };

                setState(prev => ({ ...prev, filters: newFilters }));
            }
        }
      }

      const aiMsg: ChatMessage = { 
          role: 'assistant', 
          content: result.text || (result.toolCalls.length > 0 ? "Actions executed successfully." : "I processed that."), 
          timestamp: Date.now(),
          sources: result.sources
      };
      
      setState(prev => ({ 
        ...prev, 
        chatHistory: [...prev.chatHistory, aiMsg],
        isProcessing: false 
      }));

    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = { role: 'assistant', content: "I encountered an error connecting to my creative brain.", timestamp: Date.now() };
      setState(prev => ({ ...prev, chatHistory: [...prev.chatHistory, errorMsg], isProcessing: false }));
    }
  };

  // --- Animation Interpolation Engine ---
  const interpolate = (start: number, end: number, progress: number, easing: string) => {
     // Simple easing implementation
     let p = progress;
     if (easing === 'easeOut') p = 1 - Math.pow(1 - progress, 3);
     if (easing === 'elastic') { const c4 = (2 * Math.PI) / 3; p = progress === 0 ? 0 : progress === 1 ? 1 : Math.pow(2, -10 * progress) * Math.sin((progress * 10 - 0.75) * c4) + 1; }
     return start + (end - start) * p;
  };

  const getAnimatedValue = (layer: VideoSegment, property: keyof VideoSegment['transform'] | 'opacity', baseValue: number) => {
     if (!layer.animations) return baseValue;
     
     // Find active keyframe for this property
     const relativeTime = state.currentTime - layer.start;
     const anim = layer.animations.find(a => a.property === property && relativeTime >= a.startTime && relativeTime <= (a.startTime + a.duration));
     
     if (anim) {
         const progress = (relativeTime - anim.startTime) / anim.duration;
         return interpolate(anim.startValue, anim.endValue, Math.max(0, Math.min(1, progress)), anim.easing);
     }
     
     // Check if we are past an animation (hold end value)
     const pastAnim = layer.animations
        .filter(a => a.property === property && relativeTime > (a.startTime + a.duration))
        .sort((a, b) => b.startTime - a.startTime)[0];
        
     if (pastAnim) return pastAnim.endValue;

     return baseValue;
  };

  const selectedLayer = state.layers.find(l => l.id === state.selectedLayerId);

  const renderOverlays = () => {
      return state.layers
        .filter(l => l.isActive && l.track > 0)
        .filter(l => state.currentTime >= l.start && state.currentTime <= (l.start + l.duration))
        .map(layer => {
            const scale = getAnimatedValue(layer, 'scale', layer.transform.scale);
            const rX = getAnimatedValue(layer, 'rotateX', layer.transform.rotateX);
            const rY = getAnimatedValue(layer, 'rotateY', layer.transform.rotateY);
            const rZ = getAnimatedValue(layer, 'rotateZ', layer.transform.rotateZ);
            const tX = getAnimatedValue(layer, 'translateX', layer.transform.translateX);
            const tY = getAnimatedValue(layer, 'translateY', layer.transform.translateY);
            const opacity = getAnimatedValue(layer, 'opacity', layer.opacity);

            const style: React.CSSProperties = {
                transform: `
                    perspective(${layer.transform.perspective}px)
                    translate3d(${tX}px, ${tY}px, 0)
                    rotateX(${rX}deg)
                    rotateY(${rY}deg)
                    rotateZ(${rZ}deg)
                    scale(${scale})
                `,
                opacity: opacity,
                position: 'absolute',
                top: '50%',
                left: '50%',
                transformOrigin: 'center center',
                marginTop: '-10%', // Centering hack for demo
                marginLeft: '-10%',
                pointerEvents: 'none',
            };

            if (layer.type === 'image' && layer.src) {
                return <img key={layer.id} src={layer.src} alt="overlay" className="max-w-[50%] max-h-[50%] object-contain shadow-xl" style={style} />;
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
                        fontWeight: 800,
                        letterSpacing: '0.05em'
                    }}>
                        {layer.content}
                    </div>
                );
            }
            return null;
        });
  };

  const filterStyle = `
    brightness(${state.filters.brightness}%)
    contrast(${state.filters.contrast}%)
    saturate(${state.filters.saturate}%)
    grayscale(${state.filters.grayscale}%)
    sepia(${state.filters.sepia}%)
    hue-rotate(${state.filters.hueRotate}deg)
    blur(${state.filters.blur}px)
  `;

  return (
    <div className="flex h-screen bg-[#121212] text-gray-200 overflow-hidden font-sans">
      
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        filters={state.filters}
        setFilters={(f) => setState(prev => ({ ...prev, filters: f }))}
        selectedLayer={selectedLayer}
        updateLayer={updateLayer}
        onAIChat={handleAIChat}
        isProcessing={state.isProcessing}
        chatHistory={state.chatHistory}
        onAddText={handleAddText}
      />

      <main className="flex-1 flex flex-col min-w-0">
        
        <div className="h-12 border-b border-[#2a2a2a] flex items-center justify-between px-4 bg-[#1e1e1e]">
          <div className="flex items-center gap-2">
             <div className="flex bg-[#2a2a2a] rounded overflow-hidden border border-[#333]">
                 <label className="px-3 py-1.5 hover:bg-[#333] cursor-pointer flex items-center gap-2 border-r border-[#333]">
                    <FileVideo className="w-4 h-4 text-blue-400"/>
                    <span className="text-xs font-medium">Import Video</span>
                    <input type="file" accept="video/*" className="hidden" onChange={(e) => handleImport(e, 'video')} />
                 </label>
                 <label className="px-3 py-1.5 hover:bg-[#333] cursor-pointer flex items-center gap-2">
                    <FileImage className="w-4 h-4 text-purple-400"/>
                    <span className="text-xs font-medium">Import Image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImport(e, 'image')} />
                 </label>
             </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setState(p => ({...p, showPreferences: true}))} className="p-2 hover:bg-[#333] rounded">
                <Settings className="w-4 h-4 text-gray-400"/>
            </button>
            <button className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-colors">
                <Download className="w-3 h-3" />
                <span>Export</span>
            </button>
          </div>
        </div>

        <div className="flex-1 bg-[#0a0a0a] flex items-center justify-center p-8 relative overflow-hidden">
            {state.videoUrl ? (
                <div className="relative shadow-2xl bg-black aspect-video h-[80%] max-w-full overflow-hidden group">
                    <video 
                        ref={videoRef}
                        src={state.videoUrl}
                        className="w-full h-full object-contain"
                        onLoadedMetadata={handleMetadataLoaded}
                        style={{ filter: filterStyle }}
                    />
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {renderOverlays()}
                    </div>
                </div>
            ) : (
                <div className="text-center text-gray-600">
                    <Video className="w-16 h-16 mx-auto mb-4 opacity-20"/>
                    <h2 className="text-xl font-light text-gray-500">No Sequence Active</h2>
                    <p className="text-sm">Import media to begin editing</p>
                </div>
            )}
        </div>

        <div className="h-[300px] border-t border-[#2a2a2a] flex flex-col">
           <div className="h-10 bg-[#1e1e1e] border-b border-[#2a2a2a] flex items-center justify-between px-4">
               <div className="text-xs text-gray-500 font-mono">
                   {state.currentTime.toFixed(2)}s / {state.duration.toFixed(2)}s
               </div>
               <div className="flex gap-4">
                  <button onClick={togglePlay} className="text-gray-300 hover:text-white">
                      {state.isPlaying ? <Pause className="w-5 h-5"/> : <Play className="w-5 h-5"/>}
                  </button>
               </div>
               <div className="w-20"></div>
           </div>

           <div className="flex flex-1 overflow-hidden">
               <ToolsBar activeTool={state.activeTool} setTool={(t) => setState(p => ({...p, activeTool: t}))} />
               <Timeline 
                    duration={state.duration}
                    currentTime={state.currentTime}
                    layers={state.layers}
                    selectedLayerId={state.selectedLayerId}
                    onSeek={handleSeek}
                    onSelectLayer={(id) => setState(p => ({...p, selectedLayerId: id, activeTab: p.layers.find(l=>l.id===id)?.type === 'text' ? Tab.TEXT : Tab.EFFECTS}))}
                    activeTool={state.activeTool}
               />
           </div>
        </div>
      </main>

      {state.showPreferences && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-[#1e1e1e] p-6 rounded-lg border border-[#333] w-96 shadow-2xl">
                  <h2 className="text-lg font-bold mb-4 text-white">Preferences</h2>
                  <div className="space-y-4">
                      <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">Theme</span>
                          <select className="bg-[#121212] border border-[#333] rounded px-2 py-1 text-xs">
                              <option>Dark (Pro)</option>
                              <option>Light</option>
                          </select>
                      </div>
                      <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">Auto-Save Project</span>
                          <input type="checkbox" checked={state.preferences.autoSave} readOnly className="accent-blue-500"/>
                      </div>
                      <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">Snap to Grid</span>
                          <input type="checkbox" checked={state.preferences.timelineSnap} readOnly className="accent-blue-500"/>
                      </div>
                      <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">Storage</span>
                          <span className="text-xs text-blue-500">Local Only</span>
                      </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                      <button 
                        onClick={() => setState(p => ({...p, showPreferences: false}))}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                      >
                          Close
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;