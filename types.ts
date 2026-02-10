export type LayerType = 'video' | 'image' | 'text' | 'audio' | 'adjustment';

export interface Transform3D {
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  scale: number;
  translateX: number;
  translateY: number;
  skewX?: number;
  skewY?: number;
  perspective: number;
}

export interface AnimationKeyframe {
  property: string; // Generic path like 'transform.scale' or 'filters.brightness'
  value: number;
  time: number; // relative to layer start (seconds)
  easing: 'linear' | 'easeIn' | 'easeOut' | 'bezier' | 'step';
}

export interface VideoEffect {
  id: string;
  name: string;
  category: 'Video Effect' | 'Video Transition' | 'Audio Effect';
  type: 'blur' | 'chroma' | 'glow' | 'sharpen' | 'vignette' | 'dissolve' | 'wipe';
  properties: Record<string, number>;
  enabled: boolean;
}

export interface VideoSegment {
  id: string;
  type: LayerType;
  start: number; // in seconds (timeline position)
  duration: number; // in seconds
  track: number; // 0, 1, 2 (Vertical stacking)
  label: string;
  src?: string; // For images/video/audio
  srcStartTime?: number; // Where in the source file this clip begins (For cuts)
  content?: string; // For text
  speed: number; // 1.0 is normal speed
  style?: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    textShadow?: string;
    className?: string;
  };
  transform: Transform3D;
  anchorPoint: { x: number; y: number };
  opacity: number;
  blendMode: 'normal' | 'screen' | 'multiply' | 'overlay';
  effects: VideoEffect[];
  animations: AnimationKeyframe[];
  isActive: boolean;
  locked: boolean;
}

export interface VideoFilter {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  saturation: number;
  temperature: number;
  tint: number;
  sharpness: number;
  vignette: number;
}

export interface LuminaPreset {
    id: string;
    name: string;
    category: 'Color' | 'Motion' | 'Audio';
    targetType: 'video' | 'text' | 'image' | 'global'; 
    data: {
        filters?: Partial<VideoFilter>;
        transform?: Partial<Transform3D>;
        style?: any;
    }
}

export interface ProjectFile {
    version: string;
    name: string;
    date: string;
    duration: number;
    resolution?: { width: number; height: number };
    fps?: number;
    filters: VideoFilter;
    layers: VideoSegment[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sources?: { uri: string; title: string }[];
}

export interface EditingState {
  file: File | null;
  videoUrl: string | null;
  duration: number;
  resolution: { width: number; height: number };
  fps: number;
  currentTime: number;
  zoomLevel: number; // New: Pixels per Second
  isPlaying: boolean;
  layers: VideoSegment[];
  selectedLayerId: string | null;
  filters: VideoFilter; // Global Lumetri (or Adjustment Layer logic)
  isProcessing: boolean;
  chatHistory: ChatMessage[];
  activeTool: Tool;
  activePanel: PanelType;
  showExportModal: boolean;
  preferences: {
    theme: 'dark';
    autoSave: boolean;
    timelineSnap: boolean;
  };
}

export enum PanelType {
  PROJECT = 'PROJECT',
  EFFECT_CONTROLS = 'EFFECT_CONTROLS',
  LUMETRI = 'LUMETRI',
  ESSENTIAL_GRAPHICS = 'ESSENTIAL_GRAPHICS',
  EFFECTS_LIBRARY = 'EFFECTS_LIBRARY',
  AUDIO_MIXER = 'AUDIO_MIXER',
  AI_AGENT = 'AI_AGENT'
}

export enum Tool {
  SELECTION = 'SELECTION',       // V
  TRACK_SELECT_FWD = 'TRACK_FWD',// A
  RIPPLE_EDIT = 'RIPPLE',        // B
  ROLLING_EDIT = 'ROLLING',      // N
  RAZOR = 'RAZOR',               // C
  SLIP = 'SLIP',                 // Y
  SLIDE = 'SLIDE',               // U
  PEN = 'PEN',                   // P
  HAND = 'HAND',                 // H
  ZOOM = 'ZOOM',                 // Z
  TYPE = 'TYPE',                 // T
  RATE_STRETCH = 'RATE_STRETCH'  // R
}

export const DEFAULT_TRANSFORM: Transform3D = {
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  scale: 100, // Normalized to 100% like Premiere
  translateX: 0,
  translateY: 0,
  skewX: 0,
  skewY: 0,
  perspective: 1000
};

export const DEFAULT_FILTERS: VideoFilter = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  saturation: 100,
  temperature: 0,
  tint: 0,
  sharpness: 0,
  vignette: 0
};

export const GOOGLE_FONTS = [
  'Inter', 'Roboto', 'Oswald', 'Lato', 'Poppins', 'Montserrat', 'Playfair Display'
];

export const PRESETS: LuminaPreset[] = [
    {
        id: 'p-cinematic',
        name: 'Cinematic Teal & Orange',
        category: 'Color',
        targetType: 'global',
        data: {
            filters: { temperature: -10, tint: -5, saturation: 120, contrast: 20, highlights: -10, shadows: 5 }
        }
    },
    {
        id: 'p-noir',
        name: 'Film Noir B&W',
        category: 'Color',
        targetType: 'global',
        data: {
            filters: { saturation: 0, contrast: 40, exposure: -0.5, vignette: 40, sharpness: 20 }
        }
    },
    {
        id: 'p-text-pop',
        name: 'Text: Smooth Pop In',
        category: 'Motion',
        targetType: 'text',
        data: {
            transform: { scale: 120 } // In a real engine this would be keyframes
        }
    }
];