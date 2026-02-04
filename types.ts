export type LayerType = 'video' | 'image' | 'text' | 'audio';

export interface Transform3D {
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  scale: number;
  translateX: number;
  translateY: number;
  perspective: number;
}

export interface VideoSegment {
  id: string;
  type: LayerType;
  start: number; // in seconds (timeline position)
  duration: number; // in seconds
  track: number; // 0, 1, 2 (Vertical stacking)
  label: string;
  src?: string; // For images/video/audio
  content?: string; // For text
  style?: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
  };
  transform: Transform3D;
  isActive: boolean;
}

export interface VideoFilter {
  brightness: number; 
  contrast: number;   
  saturate: number;   
  grayscale: number;  
  sepia: number;      
  hueRotate: number;  
  blur: number;       
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface EditingState {
  file: File | null; // Main video file
  videoUrl: string | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  layers: VideoSegment[]; // All timeline items
  selectedLayerId: string | null;
  filters: VideoFilter; // Global filters for main video
  isProcessing: boolean;
  chatHistory: ChatMessage[]; // Full conversation memory
  activeTool: Tool;
  preferences: {
    theme: 'dark' | 'light';
    autoSave: boolean;
    timelineSnap: boolean;
  };
  showPreferences: boolean;
}

export enum Tab {
  PROJECT = 'PROJECT',
  EFFECTS = 'EFFECTS', // Includes 3D
  TEXT = 'TEXT',
  AI_CHAT = 'AI_CHAT',
}

export enum Tool {
  SELECTION = 'SELECTION',
  RAZOR = 'RAZOR',
  HAND = 'HAND',
  TYPE = 'TYPE',
  PEN = 'PEN'
}

export const DEFAULT_TRANSFORM: Transform3D = {
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  scale: 1,
  translateX: 0,
  translateY: 0,
  perspective: 1000
};

export const DEFAULT_FILTERS: VideoFilter = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  grayscale: 0,
  sepia: 0,
  hueRotate: 0,
  blur: 0
};

export const GOOGLE_FONTS = [
  'Inter',
  'Roboto',
  'Oswald',
  'Lato',
  'Poppins',
  'Montserrat',
  'Playfair Display'
];