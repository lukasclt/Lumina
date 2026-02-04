import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Type, MessageSquare, Box, Layers, Settings, Palette, User, Bot, Send } from 'lucide-react';
import { Tab, VideoFilter, VideoSegment, Transform3D, GOOGLE_FONTS, ChatMessage } from '../types';

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  filters: VideoFilter;
  setFilters: (f: VideoFilter) => void;
  selectedLayer: VideoSegment | undefined;
  updateLayer: (id: string, updates: Partial<VideoSegment>) => void;
  onAIChat: (msg: string) => void;
  isProcessing: boolean;
  chatHistory: ChatMessage[];
  onAddText: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab, setActiveTab, filters, setFilters, 
  selectedLayer, updateLayer, onAIChat, isProcessing, chatHistory, onAddText
}) => {
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === Tab.AI_CHAT) {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, activeTab]);

  const handleFilterChange = (key: keyof VideoFilter, value: number) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleTransformChange = (key: keyof Transform3D, value: number) => {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, {
      transform: { ...selectedLayer.transform, [key]: value }
    });
  };

  const handleStyleChange = (key: string, value: any) => {
     if (!selectedLayer || !selectedLayer.style) return;
     updateLayer(selectedLayer.id, {
        style: { ...selectedLayer.style, [key]: value }
     });
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onAIChat(chatInput);
    setChatInput("");
  };

  return (
    <aside className="w-80 bg-[#1e1e1e] border-r border-[#2a2a2a] flex flex-col h-full text-xs">
      {/* Header */}
      <div className="h-12 border-b border-[#2a2a2a] flex items-center px-4 gap-2 bg-[#252525]">
        <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center">
            <Sparkles className="text-white w-3 h-3" />
        </div>
        <h1 className="font-bold text-gray-200 tracking-tight text-sm">Lumina Pro</h1>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#1e1e1e] border-b border-[#2a2a2a]">
        {[
          { id: Tab.PROJECT, icon: Layers, label: 'Project' },
          { id: Tab.EFFECTS, icon: Palette, label: 'Effects' },
          { id: Tab.TEXT, icon: Type, label: 'Text' },
          { id: Tab.AI_CHAT, icon: MessageSquare, label: 'AI Chat' },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
            className={`flex-1 py-3 flex justify-center transition-colors border-b-2 ${activeTab === tab.id ? 'text-blue-500 border-blue-500 bg-[#252525]' : 'text-gray-400 border-transparent hover:text-white'}`}
          >
            <tab.icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        
        {activeTab === Tab.PROJECT && (
          <div className="p-4 space-y-6">
            <div className="bg-[#252525] p-3 rounded border border-[#333]">
               <h3 className="font-semibold mb-2 text-gray-300">Project Stats</h3>
               <div className="space-y-1 text-gray-500">
                  <p>Resolution: 1920x1080</p>
                  <p>Frame Rate: 60fps</p>
                  <p>Bitrate: High</p>
               </div>
            </div>
            
            {/* Global Video Filters (Color Grading) */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-300">
                <Palette className="w-3 h-3"/> Master Color Grade
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Exposure', key: 'brightness', min: 0, max: 200 },
                  { label: 'Contrast', key: 'contrast', min: 0, max: 200 },
                  { label: 'Saturation', key: 'saturate', min: 0, max: 200 },
                  { label: 'Hue Shift', key: 'hueRotate', min: 0, max: 360 },
                  { label: 'Blur', key: 'blur', min: 0, max: 20 },
                ].map((control) => (
                  <div key={control.key}>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                      <span>{control.label}</span>
                      <span>{filters[control.key as keyof VideoFilter]}</span>
                    </div>
                    <input
                      type="range"
                      min={control.min}
                      max={control.max}
                      value={filters[control.key as keyof VideoFilter]}
                      onChange={(e) => handleFilterChange(control.key as keyof VideoFilter, Number(e.target.value))}
                      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === Tab.EFFECTS && (
          <div className="p-4 space-y-6">
             {!selectedLayer ? (
                 <div className="text-center text-gray-500 mt-10">Select a layer in timeline to edit transform properties.</div>
             ) : (
                <>
                    <div className="bg-[#2a2a2a] p-2 rounded mb-2 border-l-2 border-blue-500">
                        <span className="font-bold text-white">{selectedLayer.label}</span>
                    </div>
                    
                    {/* 3D Transform Controls */}
                    <div>
                        <h3 className="font-semibold mb-3 flex items-center gap-2 text-blue-400">
                            <Box className="w-3 h-3"/> 3D Transform
                        </h3>
                        <div className="space-y-3">
                            {[
                                { label: 'Scale', key: 'scale', min: 0.1, max: 3, step: 0.1 },
                                { label: 'Rotate X', key: 'rotateX', min: -180, max: 180, step: 1 },
                                { label: 'Rotate Y', key: 'rotateY', min: -180, max: 180, step: 1 },
                                { label: 'Rotate Z', key: 'rotateZ', min: -180, max: 180, step: 1 },
                                { label: 'Pos X', key: 'translateX', min: -500, max: 500, step: 5 },
                                { label: 'Pos Y', key: 'translateY', min: -500, max: 500, step: 5 },
                                { label: 'Perspective', key: 'perspective', min: 200, max: 2000, step: 50 },
                            ].map((control) => (
                                <div key={control.key}>
                                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                        <span>{control.label}</span>
                                        <span>{selectedLayer.transform[control.key as keyof Transform3D]}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={control.min}
                                        max={control.max}
                                        step={control.step}
                                        value={selectedLayer.transform[control.key as keyof Transform3D]}
                                        onChange={(e) => handleTransformChange(control.key as keyof Transform3D, Number(e.target.value))}
                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </>
             )}
          </div>
        )}

        {activeTab === Tab.TEXT && (
          <div className="p-4 space-y-4">
             <button 
                onClick={onAddText}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded flex items-center justify-center gap-2"
             >
                <Type className="w-4 h-4"/> Add Text Layer
             </button>

             {selectedLayer && selectedLayer.type === 'text' && selectedLayer.style && (
                <div className="space-y-4 border-t border-[#333] pt-4 mt-2">
                    <div>
                        <label className="block text-gray-400 mb-1">Font Family</label>
                        <select 
                            value={selectedLayer.style.fontFamily}
                            onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
                            className="w-full bg-[#2a2a2a] border border-[#444] text-white rounded p-2"
                        >
                            {GOOGLE_FONTS.map(font => (
                                <option key={font} value={font}>{font}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-gray-400 mb-1">Font Size</label>
                        <input 
                            type="number" 
                            value={selectedLayer.style.fontSize}
                            onChange={(e) => handleStyleChange('fontSize', Number(e.target.value))}
                            className="w-full bg-[#2a2a2a] border border-[#444] text-white rounded p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 mb-1">Color</label>
                        <input 
                            type="color" 
                            value={selectedLayer.style.color}
                            onChange={(e) => handleStyleChange('color', e.target.value)}
                            className="w-full bg-[#2a2a2a] h-8 rounded cursor-pointer"
                        />
                    </div>
                </div>
             )}
          </div>
        )}

        {activeTab === Tab.AI_CHAT && (
          <div className="flex flex-col h-full bg-[#18181b]">
            <div className="flex-1 p-3 overflow-y-auto space-y-4">
               {chatHistory.length === 0 && (
                  <div className="text-center text-gray-600 mt-10 p-4">
                    <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30"/>
                    <h3 className="text-sm font-semibold text-gray-400">AI Assistant Ready</h3>
                    <p className="text-[10px] mt-2">Try asking:</p>
                    <ul className="text-[10px] space-y-1 mt-2 opacity-70">
                        <li>"Add a cinematic image of a city"</li>
                        <li>"Make the video look like a movie"</li>
                        <li>"Add some upbeat royalty-free music"</li>
                        <li>"What is MrBeast's editing style?"</li>
                    </ul>
                  </div>
               )}
               
               {chatHistory.map((msg, i) => (
                   <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                       <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-purple-600' : 'bg-blue-600'}`}>
                           {msg.role === 'user' ? <User className="w-4 h-4 text-white"/> : <Bot className="w-4 h-4 text-white"/>}
                       </div>
                       <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-xs leading-relaxed ${msg.role === 'user' ? 'bg-purple-900/50 text-white rounded-tr-none' : 'bg-[#2a2a2a] text-gray-200 rounded-tl-none border border-[#333]'}`}>
                           {msg.content}
                       </div>
                   </div>
               ))}
               
               {isProcessing && (
                   <div className="flex gap-3">
                       <div className="w-8 h-8 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center">
                           <Sparkles className="w-4 h-4 text-white animate-pulse"/>
                       </div>
                       <div className="bg-[#2a2a2a] px-4 py-2 rounded-2xl rounded-tl-none border border-[#333] flex items-center gap-1">
                           <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                           <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100"></span>
                           <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                       </div>
                   </div>
               )}
               <div ref={chatEndRef} />
            </div>
            
            <div className="p-3 border-t border-[#2a2a2a] bg-[#1e1e1e]">
                <form onSubmit={handleChatSubmit} className="relative">
                <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Message Lumina AI..."
                    className="w-full bg-[#121212] border border-[#333] text-white text-xs rounded-full pl-4 pr-10 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
                <button 
                    type="submit"
                    disabled={isProcessing}
                    className="absolute right-2 top-2 p-1.5 bg-blue-600 rounded-full text-white hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
                >
                    <Send className="w-3 h-3" />
                </button>
                </form>
            </div>
          </div>
        )}

      </div>
    </aside>
  );
};