import React, { useState } from 'react';
import { X, Settings, Film } from 'lucide-react';

interface SequenceSettingsModalProps {
  onClose: () => void;
  onSave: (width: number, height: number, fps: number) => void;
  initialWidth: number;
  initialHeight: number;
  initialFps: number;
}

export const SequenceSettingsModal: React.FC<SequenceSettingsModalProps> = ({ 
    onClose, onSave, initialWidth, initialHeight, initialFps 
}) => {
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialHeight);
  const [fps, setFps] = useState(initialFps);

  const presets = [
      { label: '1080p HD (16:9)', w: 1920, h: 1080 },
      { label: '4K UHD (16:9)', w: 3840, h: 2160 },
      { label: 'Vertical / TikTok (9:16)', w: 1080, h: 1920 },
      { label: 'Square (1:1)', w: 1080, h: 1080 },
      { label: '720p HD (16:9)', w: 1280, h: 720 },
  ];

  const timebases = [23.976, 24, 25, 30, 60];

  const handlePresetClick = (p: {w: number, h: number}) => {
      setWidth(p.w);
      setHeight(p.h);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-sm">
      <div className="bg-[#1e1e1e] w-[600px] border border-[#333] shadow-2xl rounded-lg flex flex-col text-gray-200 font-sans text-xs animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="h-12 border-b border-[#2a2a2a] flex items-center justify-between px-4 bg-[#252525] rounded-t-lg">
           <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-400"/>
              <span className="font-bold text-gray-100 text-sm">Sequence Settings</span>
           </div>
           <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-4 h-4"/></button>
        </div>

        {/* Body */}
        <div className="p-6 flex gap-6">
            
            {/* Left: Settings */}
            <div className="flex-1 space-y-6">
                <div>
                    <h3 className="text-gray-400 font-bold border-b border-[#333] pb-1 mb-3">Video</h3>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-gray-500 mb-1">Frame Size</label>
                            <div className="flex gap-2 items-center">
                                <div className="flex flex-col">
                                    <input 
                                        type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} 
                                        className="bg-[#121212] border border-[#333] p-1.5 rounded w-full focus:border-blue-500 outline-none" 
                                    />
                                    <span className="text-[9px] text-gray-500 text-center mt-1">Horizontal</span>
                                </div>
                                <span className="text-gray-500 font-bold pb-4">x</span>
                                <div className="flex flex-col">
                                    <input 
                                        type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} 
                                        className="bg-[#121212] border border-[#333] p-1.5 rounded w-full focus:border-blue-500 outline-none" 
                                    />
                                    <span className="text-[9px] text-gray-500 text-center mt-1">Vertical</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-gray-500 mb-1">Ratio</label>
                            <div className="bg-[#1a1a1a] border border-[#333] p-1.5 rounded text-gray-400">
                                {(width / height).toFixed(3)} ({(width/getGcd(width,height))}:{(height/getGcd(width,height))})
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-gray-500 mb-1">Timebase (FPS)</label>
                        <select 
                            value={fps} 
                            onChange={(e) => setFps(Number(e.target.value))}
                            className="w-full bg-[#121212] border border-[#333] p-1.5 rounded focus:border-blue-500 outline-none"
                        >
                            {timebases.map(t => (
                                <option key={t} value={t}>{t} frames/second</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="bg-blue-900/20 p-3 rounded border border-blue-800/30 text-gray-400">
                    <p>Changing these settings will adjust the program monitor preview. Edits on the timeline will remain in their absolute positions.</p>
                </div>
            </div>

            {/* Right: Presets */}
            <div className="w-40 border-l border-[#333] pl-6 space-y-2">
                 <h3 className="text-gray-400 font-bold mb-2">Presets</h3>
                 {presets.map((p, i) => (
                     <button 
                        key={i}
                        onClick={() => handlePresetClick(p)}
                        className="w-full text-left px-3 py-2 bg-[#252525] hover:bg-[#333] border border-[#333] rounded text-[10px] flex items-center gap-2 group"
                     >
                         <Film className="w-3 h-3 text-gray-500 group-hover:text-blue-400"/>
                         {p.label}
                     </button>
                 ))}
            </div>

        </div>

        {/* Footer */}
        <div className="h-14 border-t border-[#2a2a2a] flex items-center justify-end px-4 gap-2 bg-[#252525] rounded-b-lg">
             <button onClick={onClose} className="px-4 py-2 rounded hover:bg-[#333] border border-[#333] transition-colors">Cancel</button>
             <button 
                onClick={() => onSave(width, height, fps)} 
                className="px-4 py-2 rounded bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors"
            >
                OK
            </button>
        </div>
      </div>
    </div>
  );
};

// Helper for aspect ratio display
function getGcd(a: number, b: number): number {
    return b === 0 ? a : getGcd(b, a % b);
}