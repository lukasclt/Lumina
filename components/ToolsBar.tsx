import React from 'react';
import { MousePointer2, Scissors, Hand, Type, PenTool } from 'lucide-react';
import { Tool } from '../types';

interface ToolsBarProps {
  activeTool: Tool;
  setTool: (t: Tool) => void;
}

export const ToolsBar: React.FC<ToolsBarProps> = ({ activeTool, setTool }) => {
  const tools = [
    { id: Tool.SELECTION, icon: MousePointer2, label: 'Selection Tool (V)' },
    { id: Tool.RAZOR, icon: Scissors, label: 'Razor Tool (C)' },
    { id: Tool.PEN, icon: PenTool, label: 'Pen Tool (P)' },
    { id: Tool.HAND, icon: Hand, label: 'Hand Tool (H)' },
    { id: Tool.TYPE, icon: Type, label: 'Type Tool (T)' },
  ];

  return (
    <div className="w-10 bg-[#1e1e1e] border-r border-[#2a2a2a] flex flex-col items-center py-2 gap-2 z-10">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setTool(tool.id)}
          title={tool.label}
          className={`p-2 rounded hover:bg-[#2a2a2a] transition-colors ${
            activeTool === tool.id ? 'text-blue-500' : 'text-gray-400'
          }`}
        >
          <tool.icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
};