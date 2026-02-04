import React from 'react';
import { 
  MousePointer2, 
  Scissors, 
  Hand, 
  Type, 
  PenTool, 
  MoveRight, 
  ArrowLeftRight, 
  ChevronsLeftRight, 
  Clock, 
  Search,
  Move
} from 'lucide-react';
import { Tool } from '../types';

interface ToolsBarProps {
  activeTool: Tool;
  setTool: (t: Tool) => void;
}

export const ToolsBar: React.FC<ToolsBarProps> = ({ activeTool, setTool }) => {
  const tools = [
    { id: Tool.SELECTION, icon: MousePointer2, label: 'Selection Tool (V)', shortcut: 'v' },
    { id: Tool.TRACK_SELECT_FWD, icon: MoveRight, label: 'Track Select Forward (A)', shortcut: 'a' },
    { id: Tool.RIPPLE_EDIT, icon: ArrowLeftRight, label: 'Ripple Edit Tool (B)', shortcut: 'b' },
    { id: Tool.ROLLING_EDIT, icon: ChevronsLeftRight, label: 'Rolling Edit Tool (N)', shortcut: 'n' },
    { id: Tool.RATE_STRETCH, icon: Clock, label: 'Rate Stretch Tool (R)', shortcut: 'r' },
    { id: Tool.RAZOR, icon: Scissors, label: 'Razor Tool (C)', shortcut: 'c' },
    { id: Tool.SLIP, icon: Move, label: 'Slip Tool (Y)', shortcut: 'y' },
    { id: Tool.PEN, icon: PenTool, label: 'Pen Tool (P)', shortcut: 'p' },
    { id: Tool.HAND, icon: Hand, label: 'Hand Tool (H)', shortcut: 'h' },
    { id: Tool.TYPE, icon: Type, label: 'Type Tool (T)', shortcut: 't' },
  ];

  return (
    <div className="w-10 bg-[#232323] border-r border-[#121212] flex flex-col items-center py-2 gap-1 z-10 shrink-0">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setTool(tool.id)}
          title={tool.label}
          className={`p-2 rounded hover:bg-[#333] transition-colors relative group ${
            activeTool === tool.id ? 'text-blue-500 bg-[#1a1a1a] border-l-2 border-blue-500' : 'text-gray-400'
          }`}
        >
          <tool.icon className="w-4 h-4" />
          {/* Tooltip */}
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
            {tool.label}
          </div>
        </button>
      ))}
    </div>
  );
};