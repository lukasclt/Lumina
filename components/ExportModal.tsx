import React from 'react';
import { X, HardDrive, Share2 } from 'lucide-react';

interface ExportModalProps {
  onClose: () => void;
  onExport: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ onClose, onExport }) => {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-[#1e1e1e] w-[800px] h-[600px] border border-[#333] shadow-2xl flex flex-col text-gray-200 font-sans text-xs">
        
        {/* Header */}
        <div className="h-10 border-b border-[#2a2a2a] flex items-center justify-between px-4 bg-[#252525]">
           <div className="flex gap-4">
              <span className="font-bold text-gray-100 border-b-2 border-blue-500 pb-2.5">Export Settings</span>
           </div>
           <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-4 h-4"/></button>
        </div>

        {/* Body */}
        <div className="flex-1 flex">
            {/* Left Preview (Mock) */}
            <div className="w-2/3 border-r border-[#2a2a2a] bg-[#121212] flex items-center justify-center p-8">
                <div className="w-full aspect-video bg-black border border-[#333] flex items-center justify-center text-gray-600">
                    Preview Frame
                </div>
            </div>

            {/* Right Settings */}
            <div className="w-1/3 bg-[#1e1e1e] flex flex-col">
                <div className="p-4 space-y-6 overflow-y-auto flex-1">
                    
                    <div>
                        <h3 className="font-bold text-blue-400 mb-2 border-b border-[#333] pb-1">File Name</h3>
                        <input type="text" defaultValue="Sequence 01" className="w-full bg-[#121212] border border-[#333] p-1 text-white"/>
                    </div>

                    <div>
                        <h3 className="font-bold text-gray-300 mb-2 border-b border-[#333] pb-1">Format</h3>
                        <div className="space-y-2">
                             <div className="flex justify-between items-center">
                                 <span className="text-gray-400">Format</span>
                                 <select className="bg-[#121212] border border-[#333] w-32">
                                     <option>H.264</option>
                                     <option>HEVC (H.265)</option>
                                     <option>ProRes</option>
                                 </select>
                             </div>
                             <div className="flex justify-between items-center">
                                 <span className="text-gray-400">Preset</span>
                                 <select className="bg-[#121212] border border-[#333] w-32">
                                     <option>High Bitrate</option>
                                     <option>Medium Bitrate</option>
                                     <option>YouTube 1080p</option>
                                 </select>
                             </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="font-bold text-gray-300 mb-2 border-b border-[#333] pb-1">Video</h3>
                         <div className="space-y-2 text-gray-400">
                             <div className="flex justify-between"><span>Width</span> <span className="text-blue-400">1920</span></div>
                             <div className="flex justify-between"><span>Height</span> <span className="text-blue-400">1080</span></div>
                             <div className="flex justify-between"><span>Frame Rate</span> <span className="text-blue-400">30</span></div>
                             <div className="flex justify-between"><span>Field Order</span> <span>Progressive</span></div>
                             <div className="flex justify-between"><span>Aspect</span> <span>Square (1.0)</span></div>
                         </div>
                    </div>

                    <div className="bg-[#252525] p-2 rounded text-[10px]">
                         <div className="flex justify-between font-bold"><span>Estimated File Size:</span> <span>24 MB</span></div>
                    </div>
                </div>

                <div className="h-12 border-t border-[#2a2a2a] flex items-center justify-end px-4 gap-2 bg-[#252525]">
                     <button onClick={onClose} className="px-4 py-1.5 rounded hover:bg-[#333] border border-[#333]">Cancel</button>
                     <button onClick={onExport} className="px-4 py-1.5 rounded bg-blue-600 text-white font-bold hover:bg-blue-700">Export</button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};