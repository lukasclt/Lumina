import React, { useState, useEffect, useRef } from 'react';
import { 
    Sparkles, Type, MessageSquare, Box, Layers, Settings, 
    Palette, User, Bot, Send, Link as LinkIcon, 
    Clock, Search, FolderOpen, Film, Image as ImageIcon,
    SlidersHorizontal, Eye, EyeOff, Plus, PlayCircle, Folder, ChevronRight, ChevronDown, Music, Wand2, FileBox, File,
    Diamond, StopCircle, MoveRight, Expand, AlignLeft, ScanLine
} from 'lucide-react';
import { PanelType, VideoFilter, VideoSegment, Transform3D, GOOGLE_FONTS, ChatMessage, PRESETS, LuminaPreset } from '../types';

interface SidebarProps {
  activePanel: PanelType;
  setActivePanel: (panel: PanelType) => void;
  filters: VideoFilter;
  setFilters: (f: VideoFilter) => void;
  selectedLayer: VideoSegment | undefined;
  updateLayer: (id: string, updates: Partial<VideoSegment>) => void;
  onAIChat: (msg: string) => void;
  isProcessing: boolean;
  chatHistory: ChatMessage[];
  onAddText: () => void;
  layers: VideoSegment[];
  onApplyPreset: (preset: LuminaPreset) => void;
  currentTime: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePanel, setActivePanel, filters, setFilters, 
  selectedLayer, updateLayer, onAIChat, isProcessing, chatHistory, onAddText, layers, onApplyPreset, currentTime
}) => {
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
      'video-transitions': true,
      'video-effects': true,
      'audio-effects': false,
      'presets': true,
      'project-root': true,
      'project-sequences': true
  });

  useEffect(() => {
    if (activePanel === PanelType.AI_AGENT) {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, activePanel]);

  const handleFilterChange = (key: keyof VideoFilter, value: number) => {
    setFilters({ ...filters, [key]: value });
  };

  // --- MOTION GRAPHICS LOGIC ---

  const getPropertyValue = (layer: VideoSegment, prop: string, defaultVal: number): number => {
      // Logic for sidebar display (show interpolated value or static value)
      const localTime = currentTime - layer.start;
      const keyframes = layer.animations.filter(k => k.property === prop).sort((a,b) => a.time - b.time);
      
      if (keyframes.length === 0) return defaultVal;
      
      // Interpolate for display
       if (localTime <= keyframes[0].time) return keyframes[0].value;
       if (localTime >= keyframes[keyframes.length - 1].time) return keyframes[keyframes.length - 1].value;
       const nextIndex = keyframes.findIndex(k => k.time > localTime);
       const nextKey = keyframes[nextIndex];
       const prevKey = keyframes[nextIndex - 1];
       const ratio = (localTime - prevKey.time) / (nextKey.time - prevKey.time);
       return prevKey.value + (nextKey.value - prevKey.value) * ratio;
  };

  const handlePropertyChange = (propPath: string, value: number, staticUpdate: any) => {
    if (!selectedLayer) return;

    const hasKeyframes = selectedLayer.animations.some(k => k.property === propPath);

    if (hasKeyframes) {
        // Add or Update Keyframe
        const localTime = currentTime - selectedLayer.start;
        // Remove existing keyframe at nearly the same time to replace it
        const newAnimations = selectedLayer.animations.filter(k => k.property !== propPath || Math.abs(k.time - localTime) > 0.05);
        
        newAnimations.push({
            property: propPath,
            time: localTime,
            value: value,
            easing: 'linear' as const
        });
        
        updateLayer(selectedLayer.id, { animations: newAnimations });
    } else {
        // Update Static Value
        updateLayer(selectedLayer.id, staticUpdate);
    }
  };

  const toggleAnimation = (propPath: string, currentValue: number) => {
      if (!selectedLayer) return;
      const hasKeyframes = selectedLayer.animations.some(k => k.property === propPath);

      if (hasKeyframes) {
          // Turn OFF animation -> Clear keyframes
          const newAnimations = selectedLayer.animations.filter(k => k.property !== propPath);
          updateLayer(selectedLayer.id, { animations: newAnimations });
      } else {
          // Turn ON animation -> Add initial keyframe
          const localTime = currentTime - selectedLayer.start;
          const newAnimations = [...selectedLayer.animations, {
              property: propPath,
              time: localTime,
              value: currentValue,
              easing: 'linear' as const
          }];
          updateLayer(selectedLayer.id, { animations: newAnimations });
      }
  };

  const addKeyframe = (propPath: string, currentValue: number) => {
      if (!selectedLayer) return;
      const localTime = currentTime - selectedLayer.start;
      // Replace or Add
      const newAnimations = selectedLayer.animations.filter(k => k.property !== propPath || Math.abs(k.time - localTime) > 0.05);
      newAnimations.push({
          property: propPath,
          time: localTime,
          value: currentValue,
          easing: 'linear' as const
      });
      updateLayer(selectedLayer.id, { animations: newAnimations });
  };

  // --- AUTOMATED PRESETS (Motion Graphics) ---
  const applyMotionPreset = (type: 'zoomIn' | 'slideIn' | 'typewriter' | 'wipe' | 'twist') => {
      if (!selectedLayer) return;
      
      const startTime = currentTime - selectedLayer.start;
      const duration = 0.8; // Default transition duration (seconds)
      const endTime = startTime + duration;

      let newKeys = [...selectedLayer.animations];

      // Helper to add a pair of keys
      const addKeys = (prop: string, startVal: number, endVal: number) => {
          // Remove existing keys in this range for this prop to avoid conflicts
           newKeys = newKeys.filter(k => k.property !== prop);
           newKeys.push({ property: prop, time: startTime, value: startVal, easing: 'bezier' });
           newKeys.push({ property: prop, time: endTime, value: endVal, easing: 'bezier' });
      };

      if (type === 'zoomIn') {
          addKeys('transform.scale', 0, 100);
          addKeys('opacity', 0, 1);
      } else if (type === 'slideIn') {
          addKeys('transform.translateY', 100, 0);
          addKeys('opacity', 0, 1);
      } else if (type === 'typewriter') {
          addKeys('text.progress', 0, 100);
      } else if (type === 'wipe') {
          // Linear Wipe: 0 to 100% visible
          addKeys('effects.wipe', 0, 100);
      } else if (type === 'twist') {
          addKeys('transform.skewX', 45, 0);
          addKeys('transform.scale', 80, 100);
          addKeys('effects.blur', 10, 0); // Motion Blur sim
          addKeys('opacity', 0, 1);
      }

      updateLayer(selectedLayer.id, { animations: newKeys });
  };


  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onAIChat(chatInput);
    setChatInput("");
  };

  const toggleFolder = (id: string) => {
      setExpandedFolders(prev => ({...prev, [id]: !prev[id]}));
  };

  const renderPropertyRow = (
      label: string, 
      value: number, 
      onChange: (v: number) => void, 
      min: number, 
      max: number, 
      unit = '', 
      propPath?: string // 'transform.scale', etc.
  ) => {
      const isAnimating = propPath && selectedLayer?.animations.some(k => k.property === propPath);
      
      return (
        <div className="flex items-center justify-between group py-1 border-b border-[#2a2a2a]/50">
            <div className="flex items-center gap-2">
                {propPath ? (
                    <button 
                        onClick={() => toggleAnimation(propPath, value)}
                        className={`hover:text-blue-400 transition-colors ${isAnimating ? 'text-blue-500' : 'text-gray-600'}`}
                        title="Toggle Animation"
                    >
                        <Clock className="w-3 h-3" />
                    </button>
                ) : (
                    <Clock className="w-3 h-3 text-gray-800 cursor-default" />
                )}
                <span className="text-gray-400 group-hover:text-white cursor-ew-resize select-none text-[11px] w-16 truncate">{label}</span>
            </div>
            
            <div className="flex items-center gap-2">
                {isAnimating && (
                    <button onClick={() => addKeyframe(propPath!, value)} className="text-gray-500 hover:text-white" title="Add/Remove Keyframe">
                        <Diamond className="w-2.5 h-2.5 fill-current"/>
                    </button>
                )}
                
                <input 
                    type="range" min={min} max={max} value={value} 
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                />
                <div className="w-10 text-right">
                    <span className="text-blue-400 text-[11px] font-mono cursor-pointer hover:bg-[#333] px-1 rounded">
                        {value.toFixed(0)}{unit}
                    </span>
                </div>
            </div>
        </div>
      );
  };

  return (
    <div className="w-full h-full bg-[#1e1e1e] flex flex-col text-xs font-sans">
      {/* Panel Tabs Header */}
      <div className="flex bg-[#161616] border-b border-[#2a2a2a] text-[11px] font-medium text-gray-400 overflow-x-auto no-scrollbar">
        {[
          { id: PanelType.PROJECT, label: 'Project' },
          { id: PanelType.EFFECT_CONTROLS, label: 'Effect Controls' },
          { id: PanelType.LUMETRI, label: 'Lumetri Color' },
          { id: PanelType.EFFECTS_LIBRARY, label: 'Effects' },
          { id: PanelType.AUDIO_MIXER, label: 'Audio Mixer' },
          { id: PanelType.ESSENTIAL_GRAPHICS, label: 'Graphics' },
          { id: PanelType.AI_AGENT, label: 'AI Agent' },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActivePanel(tab.id)}
            className={`px-3 py-2 border-t-2 whitespace-nowrap hover:bg-[#252525] hover:text-white transition-colors ${
                activePanel === tab.id ? 'border-blue-500 bg-[#252525] text-white' : 'border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1e1e1e]">
        
        {/* --- PROJECT PANEL --- */}
        {activePanel === PanelType.PROJECT && (
          <div className="p-2 select-none">
            <div className="flex items-center gap-2 mb-2 p-1 bg-[#2a2a2a] rounded text-gray-400">
                <Search className="w-3 h-3"/>
                <input type="text" placeholder="Search" className="bg-transparent outline-none w-full"/>
            </div>

            {/* Tree View Structure for Project */}
            <div>
                 <div 
                    className="flex items-center gap-1 py-1 cursor-pointer hover:bg-[#2a2a2a] text-gray-300 font-bold"
                    onClick={() => toggleFolder('project-root')}
                >
                    {expandedFolders['project-root'] ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                    <Box className="w-3 h-3 fill-gray-500 text-gray-500"/>
                    Lumina Project
                </div>
                
                {expandedFolders['project-root'] && (
                    <div className="pl-4 border-l border-[#333] ml-2">
                        {/* Sequences Bin */}
                        <div 
                            className="flex items-center gap-1 py-1 cursor-pointer hover:bg-[#2a2a2a] text-gray-400"
                            onClick={() => toggleFolder('project-sequences')}
                        >
                            {expandedFolders['project-sequences'] ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                            <Folder className="w-3 h-3 fill-blue-900 text-blue-500"/>
                            Sequences
                        </div>
                        {expandedFolders['project-sequences'] && (
                             <div className="pl-4 border-l border-[#333] ml-2 mb-2">
                                 <div className="flex items-center gap-2 py-1 hover:bg-[#333] cursor-pointer text-green-400">
                                     <Layers className="w-3 h-3"/> Sequence 01
                                 </div>
                             </div>
                        )}

                        {/* Media Files */}
                        <div className="text-[10px] font-bold text-gray-500 mt-2 mb-1 pl-1">MEDIA</div>
                        <div className="grid grid-cols-3 gap-2">
                            {layers.map(layer => (
                                <div key={layer.id} className="aspect-square bg-[#121212] border border-[#2a2a2a] hover:border-blue-500 rounded flex flex-col items-center justify-center gap-2 cursor-pointer group relative">
                                    {layer.type === 'video' ? <Film className="w-6 h-6 text-purple-500"/> : 
                                    layer.type === 'image' ? <ImageIcon className="w-6 h-6 text-pink-500"/> :
                                    <Type className="w-6 h-6 text-green-500"/>}
                                    <span className="text-[9px] text-gray-500 px-1 truncate w-full text-center">{layer.label}</span>
                                </div>
                            ))}
                             {/* Import Button */}
                             <div className="aspect-square border border-dashed border-[#333] rounded flex flex-col items-center justify-center text-gray-600 hover:text-gray-400 hover:border-gray-500">
                                 <Plus className="w-4 h-4"/>
                                 <span className="text-[9px]">Import</span>
                             </div>
                        </div>
                    </div>
                )}
            </div>
          </div>
        )}

        {/* --- EFFECTS LIBRARY --- */}
        {activePanel === PanelType.EFFECTS_LIBRARY && (
            <div className="p-2 select-none">
                 <div className="flex items-center gap-2 mb-2 p-1 bg-[#2a2a2a] rounded text-gray-400">
                    <Search className="w-3 h-3"/>
                    <input type="text" placeholder="Search Effects" className="bg-transparent outline-none w-full"/>
                </div>

                {/* Lumina Presets */}
                <div>
                    <div 
                        className="flex items-center gap-1 py-1 cursor-pointer hover:bg-[#2a2a2a] text-gray-200 font-bold"
                        onClick={() => toggleFolder('presets')}
                    >
                        {expandedFolders['presets'] ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                        <Folder className="w-3 h-3 fill-blue-600 text-blue-600"/>
                        Lumina Presets
                    </div>
                    {expandedFolders['presets'] && (
                        <div className="pl-4 border-l border-[#333] ml-2">
                            {PRESETS.map(preset => (
                                <div 
                                    key={preset.id} 
                                    onClick={() => onApplyPreset(preset)}
                                    className="py-1 pl-2 text-gray-300 hover:bg-[#333] hover:text-white cursor-pointer flex items-center gap-2 group border border-transparent hover:border-[#333]"
                                    title={`Apply ${preset.name}`}
                                >
                                    <Sparkles className="w-3 h-3 text-yellow-500"/> {preset.name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Video Transitions */}
                <div>
                    <div 
                        className="flex items-center gap-1 py-1 cursor-pointer hover:bg-[#2a2a2a] text-gray-300 font-semibold"
                        onClick={() => toggleFolder('video-transitions')}
                    >
                        {expandedFolders['video-transitions'] ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                        <Folder className="w-3 h-3 fill-yellow-600 text-yellow-600"/>
                        Video Transitions
                    </div>
                    {expandedFolders['video-transitions'] && (
                        <div className="pl-4 border-l border-[#333] ml-2">
                            {['Cross Dissolve', 'Dip to Black', 'Dip to White', 'Wipe', 'Slide', 'Push'].map(fx => (
                                <div key={fx} className="py-1 pl-2 text-gray-400 hover:bg-[#333] hover:text-white cursor-pointer flex items-center gap-2 group">
                                    <Box className="w-3 h-3 opacity-50"/> {fx}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Video Effects */}
                <div>
                    <div 
                        className="flex items-center gap-1 py-1 cursor-pointer hover:bg-[#2a2a2a] text-gray-300 font-semibold"
                        onClick={() => toggleFolder('video-effects')}
                    >
                        {expandedFolders['video-effects'] ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                        <Folder className="w-3 h-3 fill-yellow-600 text-yellow-600"/>
                        Video Effects
                    </div>
                    {expandedFolders['video-effects'] && (
                        <div className="pl-4 border-l border-[#333] ml-2">
                             <div className="text-[10px] text-gray-500 font-bold mt-1 mb-1">Blur & Sharpen</div>
                             {['Gaussian Blur', 'Sharpen', 'Directional Blur'].map(fx => (
                                <div key={fx} className="py-1 pl-2 text-gray-400 hover:bg-[#333] hover:text-white cursor-pointer flex items-center gap-2">
                                    <Wand2 className="w-3 h-3 opacity-50"/> {fx}
                                </div>
                            ))}
                             <div className="text-[10px] text-gray-500 font-bold mt-1 mb-1">Color Correction</div>
                             {['Lumetri Color', 'Tint', 'Black & White'].map(fx => (
                                <div key={fx} className="py-1 pl-2 text-gray-400 hover:bg-[#333] hover:text-white cursor-pointer flex items-center gap-2">
                                    <Wand2 className="w-3 h-3 opacity-50"/> {fx}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                 {/* Audio Effects */}
                 <div>
                    <div 
                        className="flex items-center gap-1 py-1 cursor-pointer hover:bg-[#2a2a2a] text-gray-300 font-semibold"
                        onClick={() => toggleFolder('audio-effects')}
                    >
                        {expandedFolders['audio-effects'] ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                        <Folder className="w-3 h-3 fill-green-700 text-green-700"/>
                        Audio Effects
                    </div>
                    {expandedFolders['audio-effects'] && (
                        <div className="pl-4 border-l border-[#333] ml-2">
                            {['DeNoise', 'Reverb', 'Parametric Equalizer', 'Hard Limiter'].map(fx => (
                                <div key={fx} className="py-1 pl-2 text-gray-400 hover:bg-[#333] hover:text-white cursor-pointer flex items-center gap-2 group">
                                    <Music className="w-3 h-3 opacity-50"/> {fx}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* --- AUDIO MIXER --- */}
        {activePanel === PanelType.AUDIO_MIXER && (
             <div className="p-4 flex gap-4 h-full">
                 {['A1', 'A2', 'A3', 'Master'].map((track, idx) => (
                     <div key={track} className="flex flex-col items-center h-full bg-[#121212] border border-[#333] p-2 rounded w-16">
                         <span className="text-gray-400 font-bold mb-2">{track}</span>
                         <div className="flex-1 w-2 bg-[#2a2a2a] rounded relative overflow-hidden group">
                             {/* Mock dB Meter */}
                             <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-500 via-yellow-500 to-red-500 h-[60%] opacity-50 animate-pulse"></div>
                         </div>
                         <div className="h-32 mt-2 w-full flex items-center justify-center relative">
                             {/* Fader Track */}
                             <div className="w-1 h-full bg-[#333] rounded"></div>
                             {/* Fader Handle */}
                             <div className="absolute w-8 h-4 bg-[#444] border border-gray-500 rounded shadow-lg cursor-ns-resize hover:bg-gray-300 top-1/2"></div>
                         </div>
                         <span className="mt-2 text-blue-400 font-mono">0.0</span>
                     </div>
                 ))}
             </div>
        )}

        {/* --- EFFECT CONTROLS (Updated for Keyframes) --- */}
        {activePanel === PanelType.EFFECT_CONTROLS && (
          <div className="p-0">
             {!selectedLayer ? (
                 <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                     <p>No Clip Selected</p>
                 </div>
             ) : (
                <div className="select-none">
                    <div className="bg-[#2a2a2a] px-3 py-2 border-b border-[#121212] flex justify-between items-center">
                        <span className="font-bold text-white">{selectedLayer.label}</span>
                        <span className="text-gray-500">{selectedLayer.type.toUpperCase()}</span>
                    </div>

                    {/* Transform Section */}
                    <div className="border-b border-[#2a2a2a]">
                        <div className="px-3 py-1 bg-[#232323] flex items-center gap-2">
                            <Box className="w-3 h-3 text-gray-400"/>
                            <span className="font-bold text-gray-300">Motion</span>
                        </div>
                        <div className="p-3 space-y-1">
                            {renderPropertyRow(
                                "Position X", 
                                getPropertyValue(selectedLayer, 'transform.translateX', selectedLayer.transform.translateX), 
                                (v) => handlePropertyChange('transform.translateX', v, { translateX: v }), -960, 960, '', 'transform.translateX'
                            )}
                            {renderPropertyRow(
                                "Position Y", 
                                getPropertyValue(selectedLayer, 'transform.translateY', selectedLayer.transform.translateY), 
                                (v) => handlePropertyChange('transform.translateY', v, { translateY: v }), -540, 540, '', 'transform.translateY'
                            )}
                            {renderPropertyRow(
                                "Scale", 
                                getPropertyValue(selectedLayer, 'transform.scale', selectedLayer.transform.scale), 
                                (v) => handlePropertyChange('transform.scale', v, { scale: v }), 0, 500, '%', 'transform.scale'
                            )}
                            {renderPropertyRow(
                                "Rotation", 
                                getPropertyValue(selectedLayer, 'transform.rotateZ', selectedLayer.transform.rotateZ), 
                                (v) => handlePropertyChange('transform.rotateZ', v, { rotateZ: v }), -360, 360, '°', 'transform.rotateZ'
                            )}
                            {renderPropertyRow(
                                "Opacity", 
                                getPropertyValue(selectedLayer, 'opacity', selectedLayer.opacity) * 100, 
                                (v) => handlePropertyChange('opacity', v/100, { opacity: v/100 }), 0, 100, '%', 'opacity'
                            )}
                             {/* New Advanced Props */}
                             {renderPropertyRow(
                                "Blur", 
                                getPropertyValue(selectedLayer, 'effects.blur', 0), 
                                (v) => handlePropertyChange('effects.blur', v, {}), 0, 50, 'px', 'effects.blur'
                            )}
                             {renderPropertyRow(
                                "Linear Wipe", 
                                getPropertyValue(selectedLayer, 'effects.wipe', 0), 
                                (v) => handlePropertyChange('effects.wipe', v, {}), 0, 100, '%', 'effects.wipe'
                            )}
                        </div>
                    </div>

                    {/* Blend Mode */}
                    <div className="p-3 border-b border-[#2a2a2a]">
                         <div className="flex justify-between items-center mb-2">
                             <span className="text-gray-400">Blend Mode</span>
                             <select className="bg-[#121212] border border-[#333] rounded px-2 py-0.5 text-[10px]"
                                value={selectedLayer.blendMode}
                                onChange={(e) => updateLayer(selectedLayer.id, { blendMode: e.target.value as any })}
                             >
                                 <option value="normal">Normal</option>
                                 <option value="screen">Screen</option>
                                 <option value="multiply">Multiply</option>
                                 <option value="overlay">Overlay</option>
                             </select>
                         </div>
                    </div>
                </div>
             )}
          </div>
        )}

        {/* --- LUMETRI COLOR --- */}
        {activePanel === PanelType.LUMETRI && (
          <div className="p-0">
              <div className="bg-[#2a2a2a] px-3 py-2 border-b border-[#121212] mb-2">
                  <span className="font-bold text-white flex items-center gap-2">
                      <Palette className="w-3 h-3 text-purple-400"/> Lumetri Color
                  </span>
              </div>
              
              <div className="p-3 space-y-6">
                 {/* Basic Correction */}
                 <div>
                    <h3 className="text-gray-300 font-semibold mb-2 border-b border-[#333] pb-1">Basic Correction</h3>
                    <div className="space-y-1">
                        {renderPropertyRow("Temperature", filters.temperature, (v) => handleFilterChange('temperature', v), -100, 100)}
                        {renderPropertyRow("Tint", filters.tint, (v) => handleFilterChange('tint', v), -100, 100)}
                        {renderPropertyRow("Exposure", filters.exposure, (v) => handleFilterChange('exposure', v), -5, 5)}
                        {renderPropertyRow("Contrast", filters.contrast, (v) => handleFilterChange('contrast', v), -100, 100)}
                        {renderPropertyRow("Highlights", filters.highlights, (v) => handleFilterChange('highlights', v), -100, 100)}
                        {renderPropertyRow("Shadows", filters.shadows, (v) => handleFilterChange('shadows', v), -100, 100)}
                    </div>
                 </div>

                 {/* Creative */}
                 <div>
                    <h3 className="text-gray-300 font-semibold mb-2 border-b border-[#333] pb-1">Creative</h3>
                    <div className="space-y-1">
                        {renderPropertyRow("Sharpness", filters.sharpness, (v) => handleFilterChange('sharpness', v), 0, 100)}
                        {renderPropertyRow("Vignette", filters.vignette, (v) => handleFilterChange('vignette', v), 0, 100)}
                        {renderPropertyRow("Saturation", filters.saturation, (v) => handleFilterChange('saturation', v), 0, 200)}
                    </div>
                 </div>
              </div>
          </div>
        )}

        {/* --- ESSENTIAL GRAPHICS --- */}
        {activePanel === PanelType.ESSENTIAL_GRAPHICS && (
          <div className="p-3">
             <button 
                onClick={onAddText}
                className="w-full py-2 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] text-gray-200 rounded flex items-center justify-center gap-2 mb-4"
             >
                <Plus className="w-4 h-4"/> New Text Layer
             </button>

             {selectedLayer && selectedLayer.type === 'text' && selectedLayer.style && (
                <div className="space-y-4">
                    {/* Motion Presets UI */}
                    <div className="bg-[#232323] p-2 rounded border border-[#333]">
                        <span className="block text-gray-400 font-bold mb-2 text-[10px] uppercase">Motion Presets</span>
                        <div className="grid grid-cols-3 gap-2">
                             <button onClick={() => applyMotionPreset('typewriter')} className="flex flex-col items-center gap-1 p-2 bg-[#121212] hover:bg-blue-900 rounded border border-[#2a2a2a] transition-colors">
                                <AlignLeft className="w-4 h-4 text-blue-400"/>
                                <span className="text-[9px] text-gray-300">Typewriter</span>
                             </button>
                             <button onClick={() => applyMotionPreset('zoomIn')} className="flex flex-col items-center gap-1 p-2 bg-[#121212] hover:bg-blue-900 rounded border border-[#2a2a2a] transition-colors">
                                <Expand className="w-4 h-4 text-green-400"/>
                                <span className="text-[9px] text-gray-300">Zoom In</span>
                             </button>
                             <button onClick={() => applyMotionPreset('slideIn')} className="flex flex-col items-center gap-1 p-2 bg-[#121212] hover:bg-blue-900 rounded border border-[#2a2a2a] transition-colors">
                                <MoveRight className="w-4 h-4 text-purple-400"/>
                                <span className="text-[9px] text-gray-300">Slide Up</span>
                             </button>
                             <button onClick={() => applyMotionPreset('wipe')} className="flex flex-col items-center gap-1 p-2 bg-[#121212] hover:bg-blue-900 rounded border border-[#2a2a2a] transition-colors">
                                <ScanLine className="w-4 h-4 text-yellow-400"/>
                                <span className="text-[9px] text-gray-300">Lin. Wipe</span>
                             </button>
                             <button onClick={() => applyMotionPreset('twist')} className="flex flex-col items-center gap-1 p-2 bg-[#121212] hover:bg-blue-900 rounded border border-[#2a2a2a] transition-colors">
                                <Wand2 className="w-4 h-4 text-pink-400"/>
                                <span className="text-[9px] text-gray-300">Twist</span>
                             </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-gray-500 mb-1">Font Family</label>
                        <select 
                            value={selectedLayer.style.fontFamily}
                            onChange={(e) => updateLayer(selectedLayer.id, { style: { ...selectedLayer.style, fontFamily: e.target.value } })}
                            className="w-full bg-[#121212] border border-[#333] text-white rounded p-1.5"
                        >
                            {GOOGLE_FONTS.map(font => <option key={font} value={font}>{font}</option>)}
                        </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                         <div>
                            <label className="block text-gray-500 mb-1">Fill</label>
                            <div className="flex items-center gap-2 bg-[#121212] p-1 rounded border border-[#333]">
                                <input type="color" value={selectedLayer.style.color} onChange={(e) => updateLayer(selectedLayer.id, { style: { ...selectedLayer.style, color: e.target.value } })} className="w-4 h-4 rounded border-none"/>
                                <span className="text-gray-300">{selectedLayer.style.color}</span>
                            </div>
                         </div>
                         <div>
                             <label className="block text-gray-500 mb-1">Size</label>
                             <input type="number" value={selectedLayer.style.fontSize} onChange={(e) => updateLayer(selectedLayer.id, { style: { ...selectedLayer.style, fontSize: Number(e.target.value) } })} className="w-full bg-[#121212] border border-[#333] text-white rounded p-1.5"/>
                         </div>
                    </div>
                </div>
             )}
          </div>
        )}

        {/* --- AI AGENT (GEMINI) --- */}
        {activePanel === PanelType.AI_AGENT && (
          <div className="flex flex-col h-full bg-[#18181b]">
            <div className="flex-1 p-3 overflow-y-auto space-y-4">
               {chatHistory.length === 0 && (
                  <div className="text-center text-gray-600 mt-10 p-4">
                    <Bot className="w-10 h-10 mx-auto mb-3 opacity-30"/>
                    <h3 className="text-sm font-semibold text-gray-400">Lumina Copilot</h3>
                    <p className="text-[10px] mt-2 opacity-70">"Create a cinematic intro"</p>
                  </div>
               )}
               {chatHistory.map((msg, i) => (
                   <div key={i} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                       <div className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`px-3 py-2 rounded-lg text-xs max-w-[200px] ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-[#2a2a2a] text-gray-200'}`}>
                                {msg.content}
                            </div>
                       </div>
                       {msg.sources && (
                           <div className="flex flex-wrap gap-1 ml-2">
                               {msg.sources.map((src, idx) => (
                                   <a key={idx} href={src.uri} target="_blank" className="text-[9px] text-blue-400 hover:underline flex items-center gap-1">
                                       <LinkIcon className="w-2 h-2"/> {src.title.substring(0, 15)}...
                                   </a>
                               ))}
                           </div>
                       )}
                   </div>
               ))}
               {isProcessing && <div className="text-xs text-gray-500 italic ml-2">Thinking...</div>}
               <div ref={chatEndRef} />
            </div>
            
            <div className="p-2 border-t border-[#2a2a2a] bg-[#1e1e1e]">
                <form onSubmit={handleChatSubmit} className="relative">
                <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask AI..."
                    className="w-full bg-[#121212] border border-[#333] text-white text-xs rounded pl-3 pr-8 py-2 focus:border-blue-500 outline-none"
                />
                <button type="submit" disabled={isProcessing} className="absolute right-1 top-1 p-1 text-blue-500 hover:text-white">
                    <Send className="w-3 h-3" />
                </button>
                </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};