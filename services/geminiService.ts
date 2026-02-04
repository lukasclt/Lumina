import { GoogleGenAI, FunctionDeclaration, Type, Tool } from "@google/genai";
import { VideoSegment, VideoFilter, ChatMessage } from "../types";

let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
    if (aiInstance) return aiInstance;
    try {
        // Explicitly access window.process to ensure we get the shim defined in index.html
        // preventing reference errors in module scope
        const apiKey = (window as any).process?.env?.API_KEY;
        
        if (!apiKey) {
            console.warn("API Key not found in window.process.env");
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
    description: "Analyzes the video content and automatically cuts/trims it to keep the most interesting segments.",
    parameters: { type: Type.OBJECT, properties: {}, required: [] }
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
                enum: ["noir", "teal_orange", "warm", "matrix"],
                description: "The desired mood." 
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

  // In a real scenario, we would upload the video bytes.
  // For this demo, we simulate the cut points based on duration if file is too large or API limits.
  // If file is small, we could send frames. Here we mock the intelligence for reliability in the demo.
  
  // Generating pseudo-intelligent cuts
  const cutCount = 3 + Math.floor(Math.random() * 3); // 3 to 5 cuts
  const segmentDuration = duration / cutCount;
  const segments: VideoSegment[] = [];

  for(let i=0; i<cutCount; i++) {
      // Keep 70% of the segment, remove 30% (simulating trimming boring parts)
      const start = i * segmentDuration;
      const keepDur = segmentDuration * 0.7; 
      
      segments.push({
        id: `seg-${Date.now()}-${i}`,
        type: 'video',
        track: 0,
        start: start, // Timeline position (simple sequence)
        duration: keepDur, // Source duration
        label: `Highlight ${i+1}`,
        src: '', // This needs to be filled by the caller with the actual video URL
        speed: 1,
        transform: { rotateX: 0, rotateY: 0, rotateZ: 0, scale: 100, translateX: 0, translateY: 0, perspective: 1000 },
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
  if (!ai) return { text: "AI Service Unavailable (Check API Key)", toolCalls: [] };

  const systemInstruction = `
    You are Lumina, an expert AI Video Editor.
    User Context: Duration ${currentContext.duration}s.
    
    If the user asks to "cut", "trim", or "edit" the video automatically, call 'auto_cut_video'.
    If the user asks for "text", "titles", or "graphics", call 'create_motion_graphic'.
    If the user asks for "color", "grade", or "look", call 'apply_cinematic_grade'.
    
    Be concise.
  `;

  // Filter history to simple text parts for stability
  const previousHistory = history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
  }));

  const toolsConfig: Tool[] = [
      { functionDeclarations: [cutVideoTool, motionGraphicTool, colorGradeTool] }
  ];

  try {
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
            ...previousHistory,
            { role: 'user', parts: [{ text: history[history.length - 1].content }] }
        ],
        config: {
            systemInstruction: systemInstruction,
            tools: toolsConfig
        }
    });

    const candidate = response.candidates?.[0];
    const text = candidate?.content?.parts?.find(p => p.text)?.text || "Processing your request...";
    
    const toolCalls = candidate?.content?.parts
        ?.filter(p => p.functionCall)
        .map(p => ({
            name: p.functionCall?.name,
            args: p.functionCall?.args
        })) || [];

    return { text, toolCalls };

  } catch (error) {
    console.error("Gemini Agent Error:", error);
    return { text: "Error connecting to AI. Please try again.", toolCalls: [] };
  }
};