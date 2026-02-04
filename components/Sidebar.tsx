import React, { useState, useEffect, useRef } from 'react';
import { 
    Sparkles, Type, MessageSquare, Box, Layers, Settings, 
    Palette, User, Bot, Send, Link as LinkIcon, 
    Clock, Search, FolderOpen, Film, Image as ImageIcon,
    SlidersHorizontal, Eye, EyeOff, Plus, PlayCircle
} from 'lucide-react';
import { PanelType, VideoFilter, VideoSegment, Transform3D, GOOGLE_FONTS, ChatMessage } from '../types';

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
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePanel, setActivePanel, filters, setFilters, 
  selectedLayer, updateLayer, onAIChat, isProcessing, chatHistory, onAddText, layers
}) => {
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activePanel === PanelType.AI_AGENT) {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, activePanel]);

  const handleFilterChange = (key: keyof VideoFilter, value: number) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleTransformChange = (key: keyof Transform3D, value: number) => {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, {
      transform: { ...selectedLayer.transform, [key]: value }
    });
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onAIChat(chatInput);
    setChatInput("");
  };

  const renderPropertyRow = (label: string, value: number, onChange: (v: number) => void, min: number, max: number, unit = '') => (
      <div className="flex items-center justify-between group py-1 border-b border-[#2a2a2a]/50">
          <div className="flex items-center gap-2">
             <Clock className="w-3 h-3 text-gray-600 hover:text-blue-500 cursor-pointer" />
             <span className="text-gray-400 group-hover:text-white cursor-ew-resize select-none text-[11px]">{label}</span>
          </div>
          <div className="flex items-center gap-2">
             <input 
                type="range" min={min} max={max} value={value} 
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
             />
             <span className="text-blue-400 w-10 text-right text-[11px] font-mono">{value.toFixed(0)}{unit}</span>
          </div>
      </div>
  );

  return (
    <div className="w-full h-full bg-[#1e1e1e] flex flex-col text-xs font-sans">
      {/* Panel Tabs Header */}
      <div className="flex bg-[#161616] border-b border-[#2a2a2a] text-[11px] font-medium text-gray-400 overflow-x-auto no-scrollbar">
        {[
          { id: PanelType.PROJECT, label: 'Project: Lumina' },
          { id: PanelType.EFFECT_CONTROLS, label: 'Effect Controls' },
          { id: PanelType.LUMETRI, label: 'Lumetri Color' },
          { id: PanelType.ESSENTIAL_GRAPHICS, label: 'Ess. Graphics' },
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
          <div className="p-2">
            <div className="flex items-center gap-2 mb-2 p-1 bg-[#2a2a2a] rounded text-gray-400">
                <Search className="w-3 h-3"/>
                <input type="text" placeholder="Search" className="bg-transparent outline-none w-full"/>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {layers.map(layer => (
                    <div key={layer.id} className="aspect-square bg-[#121212] border border-[#2a2a2a] hover:border-blue-500 rounded flex flex-col items-center justify-center gap-2 cursor-pointer group relative">
                        {layer.type === 'video' ? <Film className="w-6 h-6 text-purple-500"/> : 
                         layer.type === 'image' ? <ImageIcon className="w-6 h-6 text-pink-500"/> :
                         <Type className="w-6 h-6 text-green-500"/>}
                        <span className="text-[10px] text-gray-500 px-1 truncate w-full text-center">{layer.label}</span>
                        <div className="absolute top-1 right-1 text-[9px] bg-black/50 px-1 rounded text-white">{layer.duration.toFixed(1)}s</div>
                    </div>
                ))}
            </div>
          </div>
        )}

        {/* --- EFFECT CONTROLS --- */}
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
                            {renderPropertyRow("Position X", selectedLayer.transform.translateX, (v) => handleTransformChange('translateX', v), -960, 960)}
                            {renderPropertyRow("Position Y", selectedLayer.transform.translateY, (v) => handleTransformChange('translateY', v), -540, 540)}
                            {renderPropertyRow("Scale", selectedLayer.transform.scale, (v) => handleTransformChange('scale', v), 0, 500, '%')}
                            {renderPropertyRow("Rotation", selectedLayer.transform.rotateZ, (v) => handleTransformChange('rotateZ', v), -360, 360, '°')}
                            {renderPropertyRow("Opacity", selectedLayer.opacity * 100, (v) => updateLayer(selectedLayer.id, { opacity: v/100 }), 0, 100, '%')}
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