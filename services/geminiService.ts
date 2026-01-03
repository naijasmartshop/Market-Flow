import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini client
// Note: We access process.env.API_KEY directly as per instructions.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateProductDescription = async (title: string, price: number): Promise<string> => {
  try {
    const prompt = `Write a catchy, short, and selling description (max 2 sentences) for a product named "${title}" that costs $${price}. Use emojis.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "A fantastic product you will love!";
  } catch (error) {
    console.error("Gemini generation error:", error);
    return "High quality product available now.";
  }
};