import { GoogleGenAI, FunctionDeclaration, Type, Tool } from "@google/genai";
import { VideoSegment, VideoFilter, ChatMessage } from "../types";

const API_KEY = "AIzaSyDbCcx-S34kH88fOFdPy8x4yU-PK8cGQvs";

let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
    if (aiInstance) return aiInstance;
    try {
        aiInstance = new GoogleGenAI({ apiKey: API_KEY });
    } catch (e) {
        console.error("Failed to initialize GoogleGenAI", e);
        return null;
    }
    return aiInstance;
};

// --- Agent Tools Definitions ---

const cutVideoTool: FunctionDeclaration = {
    name: "auto_cut_video",
    description: "Analyzes the video content and automatically cuts/trims it to keep the most interesting 3-5 segments.",
    parameters: { type: Type.OBJECT, properties: {}, required: [] }
};

const motionGraphicTool: FunctionDeclaration = {
    name: "create_motion_graphic",
    description: "Creates a professional motion graphic layer (text or shape) with After Effects style animations.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            text: { type: Type.STRING, description: "The text content to display." },
            style: { 
                type: Type.STRING, 
                enum: ["cyberpunk_neon", "minimal_fade", "kinetic_typography", "3d_tumble", "glitch_impact"],
                description: "The visual style and animation preset."
            },
            position: { type: Type.STRING, enum: ["center", "bottom_thirds", "top_header"] }
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
                enum: ["dramatic_noir", "vibrant_vlog", "vintage_film", "matrix_green", "warm_sunset"],
                description: "The desired mood or atmosphere." 
            }
        },
        required: ["mood"]
    }
};

// --- Service Functions ---

const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64Data = result.includes(',') ? result.split(',')[1] : result;
      resolve({ inlineData: { data: base64Data, mimeType: file.type } });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeVideoForCuts = async (file: File, duration: number): Promise<VideoSegment[]> => {
  const ai = getAI();
  if (!ai) throw new Error("AI Service not configured");

  const videoPart = await fileToGenerativePart(file);
  const prompt = `
    Analyze this video. Identify the 3-5 best segments for a dynamic social media edit.
    Total duration: ${duration}s.
    Return JSON: { "segments": [{ "start": number, "end": number, "label": string }] }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }, videoPart] },
      config: { responseMimeType: "application/json" }
    });

    const json = JSON.parse(response.text?.trim() || "{}");
    if (json.segments) {
      return json.segments.map((seg: any, index: number) => ({
        id: `seg-${index}-${Date.now()}`,
        start: seg.start,
        end: seg.end,
        label: seg.label,
        isActive: true,
        type: 'video',
        track: 0,
        transform: { rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1, translateX: 0, translateY: 0, perspective: 1000 },
        opacity: 1,
        animations: []
      }));
    }
    return [];
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
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
  if (!ai) return { text: "AI Service Unavailable", toolCalls: [] };

  const systemInstruction = `
    You are Lumina AI, an expert Motion Graphics Designer and Video Editor Agent.
    
    **Capabilities**:
    1. **Auto-Cut**: Analyze and cut videos intelligently.
    2. **Motion Design**: Create complex animations (text, shapes) similar to After Effects.
    3. **Color Grading**: Apply cinematic filters.

    **Behavior**:
    - If the user wants to "cut" or "trim", use 'auto_cut_video'.
    - If the user wants text, titles, or effects, use 'create_motion_graphic'.
    - Always sound professional yet helpful.
  `;

  const previousHistory = history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
  }));

  // Note: googleSearch cannot be used together with functionDeclarations.
  // We prioritize functionDeclarations for the Editor Agent capabilities.
  const toolsConfig: Tool[] = [
      { functionDeclarations: [cutVideoTool, motionGraphicTool, colorGradeTool] }
  ];

  try {
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
            ...previousHistory.map(h => ({ role: h.role, parts: h.parts })),
            { role: 'user', parts: [{ text: history[history.length - 1].content }] }
        ],
        config: {
            systemInstruction: systemInstruction,
            tools: toolsConfig
        }
    });

    const candidate = response.candidates?.[0];
    const text = candidate?.content?.parts?.find(p => p.text)?.text || "";
    
    // Extract Function Calls
    const toolCalls = candidate?.content?.parts
        ?.filter(p => p.functionCall)
        .map(p => ({
            name: p.functionCall?.name,
            args: p.functionCall?.args
        })) || [];

    // Extract Grounding (Search) Sources (Will be empty as tool is disabled)
    const sources = candidate?.groundingMetadata?.groundingChunks
        ?.map((c: any) => c.web ? { uri: c.web.uri, title: c.web.title } : null)
        .filter(Boolean) || [];

    return { text, toolCalls, sources };

  } catch (error) {
    console.error("Gemini Agent Error:", error);
    return { text: "I encountered an error processing your request.", toolCalls: [] };
  }
};