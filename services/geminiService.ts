import { GoogleGenAI } from "@google/genai";
import { WorkSession } from "../types";

const apiKey = process.env.GEMINI_API_KEY || '';
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

export const generateCoachAdvice = async (
  sessions: WorkSession[],
  balances: Record<string, number>,
  settings: any
): Promise<string> => {
  if (!apiKey) return "API Key mancante. Impossibile generare consigli (AI non configurata).";
  
  // Analizza gli ultimi 30 giorni
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentSessions = sessions.filter(s => new Date(s.startTime) > thirtyDaysAgo);
  
  let hoursWorked = 0;
  recentSessions.forEach(s => {
    if (s.endTime) {
      hoursWorked += (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 3600000;
    }
  });

  const summary = {
    hoursLast30Days: hoursWorked.toFixed(1),
    totalBalance: balances.totalRecuperi?.toFixed(1) || 0,
    leaveBalances: settings.leaveBalances,
    recentLog: recentSessions.slice(-5).map(s => s.type).join(', ')
  };

  const prompt = `Sei un assistente analitico per la pianificazione del servizio in ambito militare. Il tuo tono è professionale, istituzionale e mai invadente.
Analizza i dati operativi recenti: ${JSON.stringify(summary)}.
Fornisci un singolo consiglio strategico, conciso e dettagliato (max 2 frasi, max 40 parole), focalizzato ESCLUSIVAMENTE sull'ottimizzazione del servizio, la gestione del monte ore e la pianificazione delle licenze/recuperi. Non usare toni emotivi o emotivamente coinvolgenti, limitati a valutazioni operative. Niente formattazione markdown.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Prenditi un momento per respirare. Il sistema non è riuscito ad elaborare i dati questa volta.";
  } catch (error) {
    return "Consiglio AI attualmente non disponibile. Riposa sempre quando puoi!";
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
