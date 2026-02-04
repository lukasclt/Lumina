import React, { useState, useRef, useEffect } from 'react';
import { PanelType } from '../types';
import { ChevronRight, Check } from 'lucide-react';

interface TopMenuProps {
  onImport: () => void;
  onSave: () => void;
  onOpen: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onRenameLayer: () => void;
  onOpenSettings: () => void;
  onOpenSequenceSettings: () => void;
  activePanel: PanelType;
  setActivePanel: (panel: PanelType) => void;
}

type MenuId = 'file' | 'edit' | 'clip' | 'sequence' | null;

export const TopMenu: React.FC<TopMenuProps> = ({
  onImport, onSave, onOpen, onExport,
  onUndo, onRedo, onDelete, onRenameLayer, onOpenSettings, onOpenSequenceSettings,
  activePanel, setActivePanel
}) => {
  const [activeMenu, setActiveMenu] = useState<MenuId>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuClick = (id: MenuId) => {
    setActiveMenu(activeMenu === id ? null : id);
  };

  const handleWorkspaceClick = (panel: PanelType) => {
    setActivePanel(panel);
    setActiveMenu(null);
  };

  const MenuDropdown = ({ children }: { children: React.ReactNode }) => (
    <div className="absolute top-full left-0 mt-1 w-56 bg-[#1e1e1e] border border-[#333] shadow-xl rounded-sm py-1 z-50 flex flex-col">
      {children}
    </div>
  );

  const MenuItem = ({ label, shortcut, onClick, disabled = false, hasSub = false }: { label: string, shortcut?: string, onClick?: () => void, disabled?: boolean, hasSub?: boolean }) => (
    <button 
      className={`px-4 py-1.5 text-left text-[11px] flex justify-between items-center hover:bg-blue-600 hover:text-white group ${disabled ? 'opacity-50 cursor-default hover:bg-transparent hover:text-gray-500' : 'text-gray-200'}`}
      onClick={() => {
        if (!disabled && onClick) {
          onClick();
          setActiveMenu(null);
        }
      }}
    >
      <span>{label}</span>
      <div className="flex items-center gap-2">
        {shortcut && <span className="text-gray-500 group-hover:text-gray-200 text-[9px]">{shortcut}</span>}
        {hasSub && <ChevronRight className="w-3 h-3"/>}
      </div>
    </button>
  );

  const Separator = () => <div className="h-px bg-[#333] my-1 mx-2"></div>;

  // Determine active workspace visually
  const isEditing = activePanel === PanelType.PROJECT || activePanel === PanelType.ESSENTIAL_GRAPHICS;
  const isColor = activePanel === PanelType.LUMETRI;
  const isEffects = activePanel === PanelType.EFFECTS_LIBRARY;
  const isAudio = activePanel === PanelType.AUDIO_MIXER;

  return (
    <div className="h-10 bg-[#1e1e1e] border-b border-[#2a2a2a] flex items-center px-4 gap-4 text-xs select-none relative" ref={menuRef}>
      {/* App Logo */}
      <div className="flex items-center gap-2 pr-2 border-r border-[#333] h-6">
        <span className="font-bold text-blue-500 text-sm">Pr</span>
        <span className="text-gray-400 font-semibold hidden md:inline">Lumina Pro</span>
      </div>

      {/* Menus */}
      <div className="flex gap-1 text-gray-300">
        
        {/* FILE MENU */}
        <div className="relative group">
          <button 
            className={`px-2 py-1 rounded hover:bg-[#333] ${activeMenu === 'file' ? 'bg-[#333] text-white' : ''}`}
            onClick={() => handleMenuClick('file')}
          >
            File
          </button>
          {activeMenu === 'file' && (
            <MenuDropdown>
              <MenuItem label="New Project..." shortcut="Ctrl+Alt+N" />
              <MenuItem label="Open Project..." shortcut="Ctrl+O" onClick={onOpen} />
              <Separator />
              <MenuItem label="Save" shortcut="Ctrl+S" onClick={onSave} />
              <MenuItem label="Save As..." shortcut="Ctrl+Shift+S" onClick={onSave} />
              <Separator />
              <MenuItem label="Import..." shortcut="Ctrl+I" onClick={onImport} />
              <MenuItem label="Export Media..." shortcut="Ctrl+M" onClick={onExport} />
              <Separator />
              <MenuItem label="Close Project" shortcut="Ctrl+Shift+W" />
              <MenuItem label="Exit" shortcut="Ctrl+Q" />
            </MenuDropdown>
          )}
        </div>

        {/* EDIT MENU */}
        <div className="relative group">
          <button 
            className={`px-2 py-1 rounded hover:bg-[#333] ${activeMenu === 'edit' ? 'bg-[#333] text-white' : ''}`}
            onClick={() => handleMenuClick('edit')}
          >
            Edit
          </button>
          {activeMenu === 'edit' && (
            <MenuDropdown>
              <MenuItem label="Undo" shortcut="Ctrl+Z" onClick={onUndo} />
              <MenuItem label="Redo" shortcut="Ctrl+Shift+Z" onClick={onRedo} />
              <Separator />
              <MenuItem label="Cut" shortcut="Ctrl+X" disabled />
              <MenuItem label="Copy" shortcut="Ctrl+C" disabled />
              <MenuItem label="Paste" shortcut="Ctrl+V" disabled />
              <MenuItem label="Duplicate" shortcut="Ctrl+D" disabled />
              <Separator />
              <MenuItem label="Select All" shortcut="Ctrl+A" />
              <MenuItem label="Deselect All" shortcut="Ctrl+Shift+A" />
              <Separator />
              <MenuItem label="Preferences" onClick={onOpenSettings} />
            </MenuDropdown>
          )}
        </div>

        {/* CLIP MENU */}
        <div className="relative group">
          <button 
            className={`px-2 py-1 rounded hover:bg-[#333] ${activeMenu === 'clip' ? 'bg-[#333] text-white' : ''}`}
            onClick={() => handleMenuClick('clip')}
          >
            Clip
          </button>
          {activeMenu === 'clip' && (
            <MenuDropdown>
              <MenuItem label="Rename..." onClick={onRenameLayer} />
              <MenuItem label="Nest..." disabled />
              <Separator />
              <MenuItem label="Speed/Duration..." shortcut="Ctrl+R" disabled />
              <MenuItem label="Audio Channels..." disabled />
              <Separator />
              <MenuItem label="Ungroup" disabled />
            </MenuDropdown>
          )}
        </div>

        {/* SEQUENCE MENU */}
        <div className="relative group">
          <button 
            className={`px-2 py-1 rounded hover:bg-[#333] ${activeMenu === 'sequence' ? 'bg-[#333] text-white' : ''}`}
            onClick={() => handleMenuClick('sequence')}
          >
            Sequence
          </button>
          {activeMenu === 'sequence' && (
            <MenuDropdown>
              <MenuItem label="Sequence Settings..." onClick={onOpenSequenceSettings} />
              <Separator />
              <MenuItem label="Render In to Out" shortcut="Enter" />
              <MenuItem label="Delete Render Files" />
              <Separator />
              <MenuItem label="Add Tracks..." />
              <MenuItem label="Delete Tracks..." />
            </MenuDropdown>
          )}
        </div>

      </div>

      <div className="flex-1"></div>

      {/* WORKSPACES (Tabs) */}
      <div className="flex gap-4 mr-4">
        <button 
           onClick={() => handleWorkspaceClick(PanelType.PROJECT)}
           className={`hover:text-white transition-colors pb-0.5 border-b-2 ${isEditing ? 'text-blue-400 border-blue-500 font-bold' : 'text-gray-400 border-transparent'}`}
        >
            Editing
        </button>
        <button 
           onClick={() => handleWorkspaceClick(PanelType.LUMETRI)}
           className={`hover:text-white transition-colors pb-0.5 border-b-2 ${isColor ? 'text-blue-400 border-blue-500 font-bold' : 'text-gray-400 border-transparent'}`}
        >
            Color
        </button>
        <button 
           onClick={() => handleWorkspaceClick(PanelType.EFFECTS_LIBRARY)}
           className={`hover:text-white transition-colors pb-0.5 border-b-2 ${isEffects ? 'text-blue-400 border-blue-500 font-bold' : 'text-gray-400 border-transparent'}`}
        >
            Effects
        </button>
        <button 
           onClick={() => handleWorkspaceClick(PanelType.AUDIO_MIXER)}
           className={`hover:text-white transition-colors pb-0.5 border-b-2 ${isAudio ? 'text-blue-400 border-blue-500 font-bold' : 'text-gray-400 border-transparent'}`}
        >
            Audio
        </button>
      </div>

      <div className="flex items-center gap-2 border-l border-[#333] pl-4">
          <button 
            className="bg-blue-600 px-3 py-1 rounded text-white font-bold hover:bg-blue-700 transition-colors"
            onClick={onExport}
          >
            Export
          </button>
      </div>
    </div>
  );
};