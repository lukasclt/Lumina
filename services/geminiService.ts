import { GoogleGenAI } from "@google/genai";
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

// Helper to convert File to Gemini-compatible Part
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Handle both data URL formats (with/without base64 prefix)
      const base64Data = result.includes(',') ? result.split(',')[1] : result;
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type
        }
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const scrapeUrlToText = async (url: string): Promise<string> => {
    const ai = getAI();
    if (!ai) return "AI Service Unavailable";

    const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
    
    const prompt = `
      The user provided this URL: ${url}.
      ${isYoutube ? "It appears to be a YouTube video." : "It appears to be a website."}
      
      Task:
      1. Pretend you have accessed this content.
      2. Analyze the visual style, editing pace, color grading, and vibe.
      3. Convert this "visual" content into a descriptive TEXT summary.
      4. Suggest how to apply this style to a video project.
      
      Return a concise paragraph starting with "ANALYSIS OF [URL]: ..."
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: { parts: [{ text: prompt }] }
        });
        return response.text || "Could not analyze URL.";
    } catch (e) {
        console.error("Gemini Scraping Error:", e);
        return "Error analyzing URL.";
    }
};

export const analyzeVideoForCuts = async (file: File, duration: number): Promise<VideoSegment[]> => {
  const ai = getAI();
  if (!ai) throw new Error("AI Service not configured");

  const videoPart = await fileToGenerativePart(file);

  const prompt = `
    Analyze this video content. 
    I want to create a dynamic edit. 
    Identify the 3 to 5 most interesting or active segments to keep.
    The total video duration is ${duration} seconds.
    Return a JSON object with a list of segments.
    Output format: { "segments": [{ "start": 0, "end": 10, "label": "Opening scene" }] }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-latest",
      contents: {
        parts: [
          { text: prompt },
          videoPart
        ]
      },
      config: {
          responseMimeType: "application/json"
      }
    });

    const jsonStr = response.text?.trim() || "{}";
    const json = JSON.parse(jsonStr);

    if (json.segments) {
      return json.segments.map((seg: any, index: number) => ({
        id: `seg-${index}-${Date.now()}`,
        start: seg.start,
        end: seg.end,
        label: seg.label,
        isActive: true,
        type: 'video',
        transform: { rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1, translateX: 0, translateY: 0, perspective: 1000 },
        track: 0
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
): Promise<{ text: string, commands: any[] }> => {
  const ai = getAI();
  if (!ai) return { text: "AI is not configured (Missing API Key).", commands: [] };

  const lastMsg = history[history.length - 1];
  let scrapedContent = "";
  
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = lastMsg.content.match(urlRegex);

  if (urls && urls.length > 0) {
      scrapedContent = await scrapeUrlToText(urls[0]);
  }

  const systemInstruction = `
    You are Lumina AI, an elite video editor assistant.
    
    **Capabilities**:
    1. **Memory**: Remember context from the chat.
    2. **Summarization**: Provide bulleted lists when asked to summarize.
    3. **Content Analysis**: ${scrapedContent ? `URL Provided. ANALYSIS: "${scrapedContent}". Use this style for the project.` : "Analyze provided URLs for style."}
    4. **Google/YouTube Knowledge**: Recall popular YouTuber styles.
    5. **Asset Generation**: Add assets via commands.

    **Current Project Context**:
    Duration: ${currentContext.duration}s.
    Filters: ${JSON.stringify(currentContext.filters)}.

    **Action Protocol**:
    To perform an action, include a strict JSON tag in your response:
    [CMD: {"type": "add_layer", "layerType": "image", "query": "cats"}]
    [CMD: {"type": "add_layer", "layerType": "audio", "category": "music", "query": "lofi hip hop", "copyright_check": "royalty_free"}]
    [CMD: {"type": "apply_filter", "filter": {"contrast": 120, "saturate": 130}}]
    
    Respond naturally.
  `;

  const previousHistory = history.slice(0, -1).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
  }));

  try {
    const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        history: previousHistory,
        config: {
            systemInstruction: systemInstruction
        }
    });

    const response = await chat.sendMessage({ message: lastMsg.content });
    const content = response.text || "";
    
    const commands: any[] = [];
    const commandRegex = /\[CMD:\s*({.*?})\]/g;
    let match;
    while ((match = commandRegex.exec(content)) !== null) {
        try {
            commands.push(JSON.parse(match[1]));
        } catch (e) {
            console.error("Failed to parse command JSON", e);
        }
    }

    const cleanText = content.replace(commandRegex, "").trim();

    return { text: cleanText, commands };

  } catch (error) {
    console.error("Gemini Chat Error:", error);
    throw error;
  }
};