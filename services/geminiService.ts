
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeFoodImage(base64Image: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: "Identify the food in this image and estimate the calories, protein, carbs, and fat per 100g. Return the data in JSON format." }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          foodName: { type: Type.STRING },
          calories: { type: Type.NUMBER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fat: { type: Type.NUMBER },
        },
        required: ["foodName", "calories", "protein", "carbs", "fat"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function getMindfulnessTip(moodRating: number, note: string, tags?: string[]) {
  const tagsText = tags?.length ? `The user also tagged their feeling as: ${tags.join(', ')}.` : '';
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on a mood rating of ${moodRating}/5 (where 1 is very low and 5 is excellent) and these user notes: "${note}". ${tagsText} Provide a single, short, encouraging mindfulness tip or wellness action. Keep it concise (under 120 characters).`,
  });
  return response.text;
}

export async function getMacroInsight(totalProtein: number, totalCarbs: number, totalFat: number, goalProtein: number) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `The user has consumed ${totalProtein}g protein, ${totalCarbs}g carbs, and ${totalFat}g fat today. Their protein goal is ${goalProtein}g. Give a 1-sentence supportive macro insight.`,
  });
  return response.text;
}
