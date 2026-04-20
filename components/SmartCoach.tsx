import React, { useState, useEffect } from 'react';
import { Sparkles, BrainCircuit, Loader2 } from 'lucide-react';
import { WorkSession } from '../types';
import * as GeminiService from '../services/geminiService';

interface SmartCoachProps {
  sessions: WorkSession[];
  balances: Record<string, number>;
  settings: any;
}

const SmartCoach: React.FC<SmartCoachProps> = ({ sessions, balances, settings }) => {
  const [advice, setAdvice] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchAdvice = async () => {
      setLoading(true);
      const result = await GeminiService.generateCoachAdvice(sessions, balances, settings);
      setAdvice(result);
      setLoading(false);
    };
    fetchAdvice();
  }, [sessions, balances, settings]);

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-4 w-full flex items-center justify-center space-x-3 text-cyan-400 dark:text-cyan-500 animate-pulse">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">Analisi parametri di servizio in corso...</span>
      </div>
    );
  }

  if (!advice) return null;

  return (
    <div className="glass-card rounded-2xl p-5 w-full relative overflow-hidden group">
      {/* Decorative neon glow */}
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-cyan-500 dark:bg-blue-600 opacity-20 rounded-full blur-2xl group-hover:bg-slate-500 transition-colors duration-700"></div>
      
      <div className="flex space-x-4 items-start relative z-10">
        <div className="bg-slate-200 dark:bg-cyan-500/20 p-2.5 rounded-xl border border-slate-300 dark:border-cyan-500/30 shadow-sm dark:shadow-[0_0_15px_rgba(6,182,212,0.3)]">
          <BrainCircuit className="w-6 h-6 text-slate-600 dark:text-cyan-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-slate-800 dark:text-cyan-200 font-semibold mb-1 text-sm flex items-center">
            Analista di Servizio
            <Sparkles className="w-3 h-3 ml-1 text-slate-400 dark:text-cyan-600" />
          </h3>
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
            {advice}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SmartCoach;
