import React, { useMemo, useState } from 'react';
import { VideoSegment, AnimationKeyframe } from '../types';
import { Activity, MousePointer2 } from 'lucide-react';

interface GraphEditorProps {
  layer: VideoSegment;
  duration: number; // Total timeline duration
  currentTime: number;
  width: number;
  height: number;
  onUpdateKeyframe: (layerId: string, newKeyframes: AnimationKeyframe[]) => void;
  onSeek: (t: number) => void;
}

export const GraphEditor: React.FC<GraphEditorProps> = ({ 
  layer, duration, currentTime, width, height, onUpdateKeyframe, onSeek
}) => {
  const [selectedProp, setSelectedProp] = useState<string | null>(null);

  // 1. Identify animateable properties present in this layer
  const animatedProps = useMemo(() => {
    const props = new Set<string>();
    layer.animations.forEach(k => props.add(k.property));
    return Array.from(props);
  }, [layer]);

  // Default to first property if none selected
  const activeProp = selectedProp || animatedProps[0];

  // 2. Filter keyframes and sort by time
  const keyframes = useMemo(() => {
      if (!activeProp) return [];
      return layer.animations
          .filter(k => k.property === activeProp)
          .sort((a, b) => a.time - b.time);
  }, [layer, activeProp]);

  // 3. Calculate ViewBox (Min/Max values) to normalize the graph vertically
  const { minVal, maxVal, range } = useMemo(() => {
      if (keyframes.length === 0) return { minVal: 0, maxVal: 100, range: 100 };
      let min = Infinity;
      let max = -Infinity;
      keyframes.forEach(k => {
          if (k.value < min) min = k.value;
          if (k.value > max) max = k.value;
      });
      // Add padding
      const padding = (max - min) * 0.2 || 50; 
      min -= padding;
      max += padding;
      return { minVal: min, maxVal: max, range: max - min };
  }, [keyframes]);

  // Helper: Map Time/Value to X/Y Coordinates
  const getX = (t: number) => (t / duration) * width;
  const getY = (v: number) => height - ((v - minVal) / range) * height; // Invert Y for SVG

  // 4. Generate SVG Path
  const pathData = useMemo(() => {
      if (keyframes.length < 2) return "";
      
      let d = `M ${getX(keyframes[0].time + layer.start)} ${getY(keyframes[0].value)}`;

      for (let i = 0; i < keyframes.length - 1; i++) {
          const curr = keyframes[i];
          const next = keyframes[i+1];
          
          const x1 = getX(curr.time + layer.start);
          const y1 = getY(curr.value);
          const x2 = getX(next.time + layer.start);
          const y2 = getY(next.value);

          // Simulate Bezier Control Points based on easing type
          // This is a simplified visual representation of "Easy Ease"
          const cpOffset = (x2 - x1) * 0.4; 
          
          let cp1x = x1 + cpOffset;
          let cp1y = y1;
          let cp2x = x2 - cpOffset;
          let cp2y = y2;

          if (next.easing === 'linear') {
               d += ` L ${x2} ${y2}`;
          } else if (next.easing === 'step') { // Instant jump
               d += ` L ${x2} ${y1} L ${x2} ${y2}`;
          } else {
               // Bezier / EaseInOut simulation
               if (next.easing === 'easeOut') { cp1x = x1 + (x2-x1)*0.1; cp1y = y2; } // Fast start, slow end? roughly
               
               // Standard S-Curve for 'bezier' or generic ease
               d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
          }
      }
      return d;
  }, [keyframes, layer.start, duration, width, height, minVal, range]);

  if (!activeProp) {
      return (
          <div className="flex items-center justify-center h-full text-gray-500 text-xs">
              Select a layer with keyframes to view graph.
          </div>
      );
  }

  return (
    <div className="flex h-full bg-[#1a1a1a] select-none">
        {/* Left: Property Selector */}
        <div className="w-48 bg-[#1e1e1e] border-r border-[#333] flex flex-col">
            <div className="px-3 py-2 text-[10px] font-bold text-gray-500 bg-[#252525]">PROPERTIES</div>
            {animatedProps.map(prop => (
                <button
                    key={prop}
                    onClick={() => setSelectedProp(prop)}
                    className={`px-3 py-2 text-left text-[11px] flex items-center gap-2 hover:bg-[#2a2a2a] ${activeProp === prop ? 'text-blue-400 bg-[#2a2a2a] border-l-2 border-blue-500' : 'text-gray-400'}`}
                >
                    <Activity className="w-3 h-3"/>
                    {prop}
                    <span className="ml-auto text-[9px] opacity-50 text-gray-500">{prop.split('.')[1]}</span>
                </button>
            ))}
            {animatedProps.length === 0 && (
                <div className="p-4 text-[10px] text-gray-600 italic">
                    Add keyframes in Effect Controls to see graphs here.
                </div>
            )}
        </div>

        {/* Right: Graph Canvas */}
        <div className="flex-1 relative overflow-hidden cursor-crosshair" onClick={(e) => {
             const rect = e.currentTarget.getBoundingClientRect();
             const x = e.clientX - rect.left;
             onSeek((x / width) * duration);
        }}>
            {/* Grid Lines (Horizontal) */}
            <div className="absolute inset-0 pointer-events-none">
                {[0.25, 0.5, 0.75].map(ratio => (
                    <div key={ratio} className="absolute w-full h-px bg-[#333] border-t border-dashed border-[#444] opacity-30" style={{ top: `${ratio * 100}%` }}></div>
                ))}
            </div>

            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
                 {/* The Curve */}
                 <path d={pathData} fill="none" stroke={activeProp.includes('X') ? '#ef4444' : activeProp.includes('Y') ? '#22c55e' : '#3b82f6'} strokeWidth="2" />
                 
                 {/* Keyframe Points */}
                 {keyframes.map((k, i) => {
                     const cx = getX(k.time + layer.start);
                     const cy = getY(k.value);
                     return (
                         <g key={i}>
                            {/* Handle Lines (Visual Only for now) */}
                            <circle cx={cx} cy={cy} r="4" fill="#fbbf24" stroke="#000" strokeWidth="1" className="cursor-pointer hover:scale-125 transition-transform"/>
                         </g>
                     );
                 })}
            </svg>
            
            {/* Playhead Line in Graph */}
            <div 
                className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none"
                style={{ left: `${(currentTime / duration) * 100}%` }}
            ></div>
            
            {/* Value Indicator at Playhead (approx) */}
            {/* <div className="absolute top-2 right-2 text-[10px] text-gray-400 font-mono bg-black/50 px-1 rounded">
                Val: {keyframes.length > 0 ? getInterpolatedValue... : 0}
            </div> */}
        </div>
    </div>
  );
};
