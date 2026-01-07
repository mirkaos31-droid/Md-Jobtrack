import { GoogleGenAI } from "@google/genai";
import { WorkSession } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const refineActivityText = async (rawText: string): Promise<string> => {
  if (!apiKey) return rawText;
  if (!rawText.trim()) return "";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a professional assistant. Rewrite the following rough work log into a concise, professional bulleted list in Italian. Remove emotion, focus on tasks.
      
      Input: "${rawText}"
      
      Output (Markdown):`,
    });
    
    return response.text || rawText;
  } catch (error) {
    console.error("Gemini refinement error:", error);
    return rawText;
  }
};

export const generateWeeklyReport = async (sessions: WorkSession[]): Promise<string> => {
  if (!apiKey) return "API Key mancante. Impossibile generare report.";
  
  // Prepare simplified data for the prompt
  const dataSummary = sessions.map(s => ({
    date: new Date(s.startTime).toLocaleDateString('it-IT'),
    duration: s.endTime ? (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 1000 / 3600 : 0,
    tasks: s.activityRefined || s.activityRaw
  })).slice(-10); // Last 10 sessions to keep context small

  const prompt = `Analizza i seguenti dati sulle sessioni di lavoro recenti e fornisci un breve riepilogo in Italiano (max 100 parole) evidenziando le aree principali di focus e la produttività.

  Dati: ${JSON.stringify(dataSummary)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Impossibile generare il report.";
  } catch (error) {
    return "Errore durante la generazione del report.";
  }
};
