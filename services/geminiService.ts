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
    description: "Analyzes the video audio to make smart cuts. Use for pacing or removing silence.",
    parameters: { 
        type: Type.OBJECT, 
        properties: {
            mode: {
                type: Type.STRING,
                enum: ["remove_silence", "pace"],
                description: "Choose 'remove_silence' to cut low volume parts, or 'pace' for dynamic stylistic cuts."
            },
            intensity: {
                type: Type.STRING,
                enum: ["low", "medium", "high"],
                description: "How aggressive the cut should be."
            }
        }, 
        required: ["mode"] 
    }
};

const memeTool: FunctionDeclaration = {
    name: "search_and_add_meme",
    description: "Searches for a meme (video or image) from the internet and adds it to the timeline.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            keyword: { type: Type.STRING, description: "The search term for the meme (e.g., 'cat crying', 'explosion', 'confused math')." },
            type: { 
                type: Type.STRING, 
                enum: ["image", "video"],
                description: "Whether to find an image/gif or a video meme."
            }
        },
        required: ["keyword", "type"]
    }
};

const soundTool: FunctionDeclaration = {
    name: "search_and_add_sound",
    description: "Searches for a sound effect (SFX) or background music and adds it to an audio track.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            keyword: { type: Type.STRING, description: "Description of the sound (e.g., 'vine boom', 'lofi beat', 'whoosh transition')." },
            category: { 
                type: Type.STRING, 
                enum: ["sfx", "music"],
                description: "Is it a short sound effect (SFX) or background music?"
            }
        },
        required: ["keyword", "category"]
    }
};

const designTool: FunctionDeclaration = {
    name: "modify_layer_design",
    description: "Modifies the style, position, or scale of an existing layer (text or image/video) on the timeline.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            targetDescription: { type: Type.STRING, description: "Description of the layer to modify (e.g., 'the big title', 'the video clip')." },
            properties: {
                type: Type.OBJECT,
                properties: {
                    color: { type: Type.STRING, description: "Hex color code for text." },
                    scale: { type: Type.NUMBER, description: "Scale percentage (100 is normal)." },
                    position: { type: Type.STRING, enum: ["center", "top", "bottom", "left", "right"], description: "Predefined position." },
                    font: { type: Type.STRING, description: "Font family name." }
                }
            }
        },
        required: ["targetDescription", "properties"]
    }
};

const timelineTool: FunctionDeclaration = {
    name: "manage_timeline",
    description: "Adds text or removes items from the timeline.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            action: { type: Type.STRING, enum: ["add_text", "remove_layer"], description: "Action to perform." },
            details: { type: Type.STRING, description: "For add_text: the content. For remove_layer: description of what to remove." }
        },
        required: ["action", "details"]
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
  currentContext: { filters: VideoFilter, duration: number, layers: VideoSegment[] }
): Promise<{ 
    text: string; 
    toolCalls: any[]; 
    sources?: { uri: string; title: string }[] 
}> => {
  const ai = getAI();
  if (!ai) return { text: "⚠️ API Key not configured. Go to Edit > Preferences to set your Google Gemini API Key.", toolCalls: [] };

  // 1. Build Layer Context String
  const layersDesc = currentContext.layers.map((l, i) => 
    `[${i}] ID:${l.id} Type:${l.type} Label:"${l.label}" Start:${l.start.toFixed(1)}s Content:"${l.content || ''}" Color:${l.style?.color || 'N/A'}`
  ).join('\n');

  const systemInstruction = `
    You are Lumina, a Professional AI Video Editor.
    
    CURRENT PROJECT CONTEXT:
    - Duration: ${currentContext.duration.toFixed(1)}s
    - Existing Layers (Timeline):
    ${layersDesc}
    
    CAPABILITIES:
    1. CUTTING: Remove silence or pace video ('auto_cut_video').
    2. MEMES/ASSETS: Add memes from internet ('search_and_add_meme').
    3. SOUND: Add Sound Effects (SFX) or Background Music ('search_and_add_sound').
    4. DESIGN: Modify ANY visual property of a layer (color, scale, position) using 'modify_layer_design'.
    5. TIMELINE: Add text or remove specific layers ('manage_timeline').
    6. COLOR: Apply color grading ('apply_cinematic_grade').
    
    INSTRUCTIONS:
    - If the user sends an image, analyze it and use it as a reference or inspiration.
    - If asked to "put a cat meme", use 'search_and_add_meme'.
    - If asked to "add a vine boom", use 'search_and_add_sound' with category 'sfx'.
    - If asked to "add lofi music", use 'search_and_add_sound' with category 'music'.
    - If asked to "change the text color to blue", identify the text layer in Context and use 'modify_layer_design'.
    - Be concise.
  `;

  // 2. Format Contents (Multimodal)
  const contents = history.map(msg => {
      const parts: any[] = [{ text: msg.content }];
      
      if (msg.attachments) {
          msg.attachments.forEach(att => {
              if (att.base64 && att.mimeType) {
                  parts.push({
                      inlineData: {
                          mimeType: att.mimeType,
                          data: att.base64
                      }
                  });
              }
          });
      }
      
      return {
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: parts
      };
  });

  const toolsConfig: Tool[] = [
      { functionDeclarations: [cutVideoTool, memeTool, soundTool, designTool, timelineTool, colorGradeTool] }
  ];

  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image", 
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
        
    const finalText = text || (toolCalls.length > 0 ? "Executing edits..." : "I didn't understand that.");

    return { text: finalText, toolCalls };

  } catch (error: any) {
    console.error("Gemini Agent Error:", error);
    const errorMsg = error.message || "Error connecting to AI.";
    return { text: `Error: ${errorMsg}. Please try again.`, toolCalls: [] };
  }
};