import React, { useState, useEffect } from 'react';
import { X, Key, Save, AlertTriangle } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
  onSave: (apiKey: string) => void;
  initialKey: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onSave, initialKey }) => {
  const [apiKey, setApiKey] = useState(initialKey);
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-sm">
      <div className="bg-[#1e1e1e] w-[500px] border border-[#333] shadow-2xl rounded-lg flex flex-col text-gray-200 font-sans text-xs animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="h-12 border-b border-[#2a2a2a] flex items-center justify-between px-4 bg-[#252525] rounded-t-lg">
           <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-500"/>
              <span className="font-bold text-gray-100 text-sm">Settings</span>
           </div>
           <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-4 h-4"/></button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
            
            <div className="bg-yellow-900/20 border border-yellow-700/50 p-3 rounded flex gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0"/>
                <div className="text-gray-400">
                    <p className="font-bold text-yellow-500 mb-1">API Key Required</p>
                    <p>To use Lumina AI features (Auto-Cut, Grading, Chat), you need a Google Gemini API Key. This key is stored locally in your browser cookies.</p>
                </div>
            </div>

            <div className="space-y-2">
                <label className="block text-gray-300 font-medium">Gemini API Key</label>
                <div className="relative">
                    <input 
                        type={isVisible ? "text" : "password"} 
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full bg-[#121212] border border-[#333] rounded p-2.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none pr-10 font-mono"
                    />
                    <button 
                        type="button"
                        onClick={() => setIsVisible(!isVisible)}
                        className="absolute right-3 top-2.5 text-gray-500 hover:text-white"
                    >
                        {isVisible ? "Hide" : "Show"}
                    </button>
                </div>
                <p className="text-[10px] text-gray-500">
                    Don't have a key? <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-400 hover:underline">Get one here</a>.
                </p>
            </div>
        </div>

        {/* Footer */}
        <div className="h-14 border-t border-[#2a2a2a] flex items-center justify-end px-4 gap-2 bg-[#252525] rounded-b-lg">
             <button onClick={onClose} className="px-4 py-2 rounded hover:bg-[#333] border border-[#333] transition-colors">Cancel</button>
             <button 
                onClick={() => onSave(apiKey)} 
                className="px-4 py-2 rounded bg-blue-600 text-white font-bold hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!apiKey.trim()}
            >
                <Save className="w-3 h-3"/> Save Settings
            </button>
        </div>
      </div>
    </div>
  );
};