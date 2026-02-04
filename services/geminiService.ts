import { GoogleGenAI, FunctionDeclaration, Type, Tool } from "@google/genai";
import { VideoSegment, VideoFilter, ChatMessage, DEFAULT_TRANSFORM } from "../types";

let aiInstance: GoogleGenAI | null = null;

// Helper to get cookie
const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

export const resetAI = () => {
    aiInstance = null;
    console.log("AI Instance reset. New key will be used on next call.");
};

const getAI = () => {
    if (aiInstance) return aiInstance;
    try {
        const apiKey = getCookie('gemini_api_key');
        
        if (!apiKey) {
            console.warn("API Key not found in cookies.");
            return null;
        }

        aiInstance = new GoogleGenAI({ apiKey: apiKey });
    } catch (e) {
        console.error("Failed to initialize GoogleGenAI. Check API Key.", e);
        return null;
    }
    return aiInstance;
};

// --- Agent Tools Definitions ---

const cutVideoTool: FunctionDeclaration = {
    name: "auto_cut_video",
    description: "Analyzes the video. Use 'mode: remove_silence' to cut breaths/pauses. Use 'mode: pace' for rhythmic editing.",
    parameters: { 
        type: Type.OBJECT, 
        properties: {
            mode: {
                type: Type.STRING,
                enum: ["remove_silence", "pace"],
                description: "Choose 'remove_silence' to cut low volume parts (breaths), or 'pace' for stylistic cuts."
            },
            intensity: {
                type: Type.STRING,
                enum: ["low", "medium", "high"],
                description: "For silence: threshold sensitivity. For pace: speed of cuts."
            }
        }, 
        required: ["mode"] 
    }
};

const motionGraphicTool: FunctionDeclaration = {
    name: "create_motion_graphic",
    description: "Creates a professional motion graphic layer (text) with animations.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            text: { type: Type.STRING, description: "The text content to display." },
            style: { 
                type: Type.STRING, 
                enum: ["cyberpunk", "minimal", "bold", "luxury"],
                description: "The visual style."
            }
        },
        required: ["text", "style"]
    }
};

const colorGradeTool: FunctionDeclaration = {
    name: "apply_cinematic_grade",
    description: "Applies a cinematic color grading filter to the entire video.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            mood: { 
                type: Type.STRING, 
                enum: ["noir", "teal_orange", "warm", "matrix", "clean"],
                description: "The desired mood." 
            }
        },
        required: ["mood"]
    }
};

// --- REAL AUDIO ANALYSIS LOGIC ---

const detectSilenceAndCut = async (file: File, threshold = 0.02, minSilenceDuration = 0.4): Promise<VideoSegment[]> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const rawData = audioBuffer.getChannelData(0); // Analyze left channel
        const sampleRate = audioBuffer.sampleRate;
        const segments: VideoSegment[] = [];
        
        let isSpeaking = false;
        let speakStart = 0;
        let silenceStart = 0;
        
        // Window size for RMS calculation (e.g., 50ms)
        const windowSize = Math.floor(sampleRate * 0.05); 
        
        for (let i = 0; i < rawData.length; i += windowSize) {
            // Calculate RMS (Root Mean Square) volume for this window
            let sum = 0;
            for (let j = 0; j < windowSize && i + j < rawData.length; j++) {
                sum += rawData[i + j] * rawData[i + j];
            }
            const rms = Math.sqrt(sum / windowSize);
            
            if (rms > threshold) {
                // Sound detected
                if (!isSpeaking) {
                    isSpeaking = true;
                    speakStart = i / sampleRate;
                    // Add a tiny bit of padding before (attack)
                    speakStart = Math.max(0, speakStart - 0.1);
                }
            } else {
                // Silence detected
                if (isSpeaking) {
                    const currentTime = i / sampleRate;
                    if (currentTime - silenceStart > minSilenceDuration) {
                        // We found a valid silence gap, commit the previous speech segment
                        isSpeaking = false;
                        const duration = currentTime - speakStart;
                        
                        // Only keep segments longer than 0.5s to avoid glitches
                        if (duration > 0.5) {
                            segments.push({
                                id: `seg-${Date.now()}-${segments.length}`,
                                type: 'video',
                                track: 0,
                                start: 0, // Will be recalculated sequentially by the caller
                                duration: duration, // Source duration
                                srcStartTime: speakStart, // Custom prop for source mapping (handled in simulation by just keeping duration)
                                label: `Clip ${segments.length + 1}`,
                                src: '', 
                                speed: 1,
                                transform: { ...DEFAULT_TRANSFORM },
                                anchorPoint: { x: 0.5, y: 0.5 },
                                opacity: 1,
                                blendMode: 'normal',
                                effects: [],
                                animations: [],
                                isActive: true,
                                locked: false
                            });
                        }
                    }
                } else {
                    silenceStart = i / sampleRate;
                }
            }
        }

        // Handle end of file
        if (isSpeaking) {
             const duration = (rawData.length / sampleRate) - speakStart;
             segments.push({
                id: `seg-${Date.now()}-${segments.length}`,
                type: 'video',
                track: 0,
                start: 0,
                duration: duration,
                srcStartTime: speakStart,
                label: `Clip ${segments.length + 1}`,
                src: '', 
                speed: 1,
                transform: { ...DEFAULT_TRANSFORM },
                anchorPoint: { x: 0.5, y: 0.5 },
                opacity: 1,
                blendMode: 'normal',
                effects: [],
                animations: [],
                isActive: true,
                locked: false
            });
        }

        return segments;

    } catch (e) {
        console.error("Audio Analysis Failed:", e);
        throw new Error("Could not analyze audio track. Make sure the video has audio.");
    }
};

// --- SERVICE FUNCTIONS ---

export const analyzeVideoForCuts = async (file: File, duration: number, mode: 'remove_silence' | 'pace', intensity: string): Promise<VideoSegment[]> => {
  
  // REAL ANALYSIS: Remove Silence / Breaths
  if (mode === 'remove_silence') {
      let threshold = 0.02; // Default Medium
      if (intensity === 'high') threshold = 0.05; // Aggressive cut (cuts quiet talking too)
      if (intensity === 'low') threshold = 0.005; // Gentle cut (only cuts absolute silence)

      console.log("Starting Audio Analysis...");
      const segments = await detectSilenceAndCut(file, threshold);
      
      // Post-process: Layout sequentially on timeline
      let currentTime = 0;
      return segments.map(seg => {
          const s = { ...seg, start: currentTime };
          currentTime += seg.duration;
          return s;
      });
  }

  // SIMULATION: Stylistic Pacing (Randomized)
  let minCuts = 3;
  let maxCuts = 5;
  
  if (intensity === 'high') { // Fast pace
      minCuts = 8;
      maxCuts = 15;
  } else if (intensity === 'low') { // Slow pace
      minCuts = 2;
      maxCuts = 4;
  }

  const cutCount = minCuts + Math.floor(Math.random() * (maxCuts - minCuts + 1));
  const segmentDuration = duration / cutCount;
  const segments: VideoSegment[] = [];

  for(let i=0; i<cutCount; i++) {
      const start = i * segmentDuration;
      const keepDur = segmentDuration * 0.8; // Keep 80%
      
      segments.push({
        id: `seg-${Date.now()}-${i}`,
        type: 'video',
        track: 0,
        start: segments.length > 0 ? (segments[segments.length-1].start + segments[segments.length-1].duration) : 0,
        duration: keepDur,
        srcStartTime: start, // Simulate jumping ahead
        label: `Scene ${i+1}`,
        src: '',
        speed: 1,
        transform: { ...DEFAULT_TRANSFORM },
        anchorPoint: {x: 0.5, y:0.5},
        opacity: 1,
        blendMode: 'normal',
        effects: [],
        animations: [],
        isActive: true,
        locked: false
      });
  }

  return segments;
};

export const chatWithAI = async (
  history: ChatMessage[], 
  currentContext: { filters: VideoFilter, duration: number }
): Promise<{ 
    text: string; 
    toolCalls: any[]; 
    sources?: { uri: string; title: string }[] 
}> => {
  const ai = getAI();
  if (!ai) return { text: "⚠️ API Key not configured. Go to Edit > Preferences to set your Google Gemini API Key.", toolCalls: [] };

  const systemInstruction = `
    You are Lumina, a Professional AI Video Editor.
    Context: Video Duration ${currentContext.duration.toFixed(1)}s.
    
    TASKS:
    1. CUTTING: If user mentions "silence", "breaths", "pauses", or "clean up audio", call 'auto_cut_video' with mode='remove_silence'.
       If user mentions "fast cut", "dynamic", "music video style", call 'auto_cut_video' with mode='pace'.
    2. GRAPHICS: If user wants text/titles, call 'create_motion_graphic'. Choose a style that fits the request.
    3. COLOR: If user wants specific looks, call 'apply_cinematic_grade'.
    
    RESPONSE:
    Be short, professional, and confirm the action. Example: "Removing silent parts to tighten the flow."
  `;

  const contents = history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
  }));

  const toolsConfig: Tool[] = [
      { functionDeclarations: [cutVideoTool, motionGraphicTool, colorGradeTool] }
  ];

  try {
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: contents,
        config: {
            systemInstruction: systemInstruction,
            tools: toolsConfig
        }
    });

    const candidate = response.candidates?.[0];
    const text = candidate?.content?.parts?.find(p => p.text)?.text || "";
    
    const toolCalls = candidate?.content?.parts
        ?.filter(p => p.functionCall)
        .map(p => ({
            name: p.functionCall?.name,
            args: p.functionCall?.args
        })) || [];
        
    const finalText = text || (toolCalls.length > 0 ? "Processing edits..." : "I didn't understand that.");

    return { text: finalText, toolCalls };

  } catch (error: any) {
    console.error("Gemini Agent Error:", error);
    const errorMsg = error.message || "Error connecting to AI.";
    return { text: `Error: ${errorMsg}. Please try again.`, toolCalls: [] };
  }
};