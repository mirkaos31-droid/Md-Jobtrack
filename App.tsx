import React, { useState, useEffect } from 'react';
import { Plus, Save, Clock, Calendar, BarChart2, Settings, Sparkles, Trash2, Info, TrendingUp, TrendingDown, Briefcase, Palmtree, Award, RotateCcw, BatteryCharging, FileText } from 'lucide-react';
import { WorkSession, UserSettings, SessionType } from './types';
import * as Storage from './services/storageService';
import * as GeminiService from './services/geminiService';
import * as DateService from './services/dateService';
import WorkChart from './components/WorkChart';

const App: React.FC = () => {
  // State
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ 
    schedule: { monThu: 8.5, fri: 4, satSun: 0 },
    leaveBalances: { ord_2025: 0, ord_2026: 0, lic_937: 0, rec_fest: 0, com_log: 0 }
  });
  
  const [view, setView] = useState<'dashboard' | 'history' | 'settings'>('dashboard');
  
  // Manual Entry State
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryStart, setEntryStart] = useState('08:00');
  const [entryEnd, setEntryEnd] = useState('16:30');
  const [entryType, setEntryType] = useState<SessionType>('work');
  const [entryActivity, setEntryActivity] = useState('');

  // UI State for Activity Editing / AI
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [activityText, setActivityText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  // Initialize
  useEffect(() => {
    const loadedSessions = Storage.loadSessions();
    const loadedSettings = Storage.loadSettings();
    setSessions(loadedSessions);
    setSettings(loadedSettings);
  }, []);

  // Persist sessions whenever they change
  useEffect(() => {
    Storage.saveSessions(sessions);
  }, [sessions]);

  // Persist settings
  useEffect(() => {
    Storage.saveSettings(settings);
  }, [settings]);

  // --- Logic ---

  const handleAddManualSession = async () => {
    if (!entryDate) return;

    let startDateTime: Date;
    let endDateTime: Date;

    // Work OR Com Log (Hourly)
    if (entryType === 'work' || entryType === 'com_log') {
      if (!entryStart || !entryEnd) return;
      startDateTime = new Date(`${entryDate}T${entryStart}`);
      endDateTime = new Date(`${entryDate}T${entryEnd}`);

      if (endDateTime <= startDateTime) {
        alert("L'orario di fine deve essere successivo all'inizio.");
        return;
      }
    } else if (entryType === 'rec_comp') {
       // Recupero Compensativo: Save with 0 duration.
       // The dateService handles the logic to deduct full target from Monte Ore.
       startDateTime = new Date(`${entryDate}T09:00:00`);
       endDateTime = new Date(`${entryDate}T09:00:00`);
    } else {
      // Standard Full-Day Leave (Ord/Lic)
      const targetHours = DateService.getTargetHoursForDate(entryDate, settings);
      startDateTime = new Date(`${entryDate}T09:00:00`);
      endDateTime = new Date(startDateTime.getTime() + targetHours * 60 * 60 * 1000);
    }

    const newSession: WorkSession = {
      id: crypto.randomUUID(),
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      type: entryType,
      activityRaw: entryActivity,
      activityRefined: entryActivity,
      tags: []
    };

    setSessions(prev => [...prev, newSession]);
    
    // Reset activity but keep times/date for easier sequential entry
    setEntryActivity('');
    
    // AI Refinement Trigger (only for actual work)
    if (entryActivity && entryType === 'work') {
       setIsAiLoading(true);
       try {
         const refined = await GeminiService.refineActivityText(entryActivity);
         setSessions(prev => prev.map(s => s.id === newSession.id ? { ...s, activityRefined: refined } : s));
       } catch(e) { console.error(e) }
       setIsAiLoading(false);
    }
  };

  const handleSaveActivity = async (sessionId: string) => {
    setSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, activityRaw: activityText, activityRefined: activityText } : s
    ));
    setEditingSessionId(null);
    setActivityText('');
  };

  const handleRefineWithAI = async (sessionId: string) => {
    setIsAiLoading(true);
    const refined = await GeminiService.refineActivityText(activityText);
    
    setSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, activityRaw: activityText, activityRefined: refined } : s
    ));
    setActivityText(refined); 
    setIsAiLoading(false);
  };

  const handleDeleteSession = (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questa sessione?")) {
      setSessions(prev => prev.filter(s => s.id !== id));
    }
  };

  const generateReport = async () => {
    setIsAiLoading(true);
    const report = await GeminiService.generateWeeklyReport(sessions.filter(s => s.type === 'work'));
    setAiReport(report);
    setIsAiLoading(false);
  };

  // --- Derived Data ---
  
  const todayDateStr = new Date().toISOString();
  const todayLocale = new Date().toLocaleDateString('it-IT');
  
  // Total Balance (Monte Ore - Straordinario)
  const totalBalance = DateService.calculateTotalBalance(sessions, settings);

  // Leave Calculations (in Integers/Days)
  const usedLeaveDays = DateService.calculateUsedLeave(sessions);
  const earnedDays = DateService.calculateEarnedDays(sessions);
  
  const balanceOrd2025 = settings.leaveBalances.ord_2025 - usedLeaveDays.ord_2025;
  const balanceOrd2026 = settings.leaveBalances.ord_2026 - usedLeaveDays.ord_2026;
  const balanceLic937 = settings.leaveBalances.lic_937 - usedLeaveDays.lic_937;
  // Rec Fest: Initial + Earned (Working on Holidays) - Used
  const balanceRecFest = (settings.leaveBalances.rec_fest + earnedDays.rec_fest) - usedLeaveDays.rec_fest;
  const balanceComLog = (settings.leaveBalances.com_log || 0) - usedLeaveDays.com_log;

  // Grouped History for Display
  const sessionsByDay = sessions.reduce((acc, session) => {
    const day = new Date(session.startTime).toLocaleDateString('it-IT');
    if (!acc[day]) acc[day] = [];
    acc[day].push(session);
    return acc;
  }, {} as Record<string, WorkSession[]>);

  const sortedDays = Object.keys(sessionsByDay).sort((a, b) => {
    const [da, ma, ya] = a.split('/').map(Number);
    const [db, mb, yb] = b.split('/').map(Number);
    return new Date(yb, mb-1, db).getTime() - new Date(ya, ma-1, da).getTime();
  });

  const isEntryDateHoliday = DateService.isHoliday(new Date(entryDate));

  // Helper to get color for session type
  const getTypeColor = (type: SessionType) => {
    switch(type) {
      case 'work': return 'text-slate-700 bg-slate-50 border-slate-200';
      case 'ord_2025': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'ord_2026': return 'text-indigo-700 bg-indigo-50 border-indigo-200';
      case 'lic_937': return 'text-purple-700 bg-purple-50 border-purple-200';
      case 'rec_fest': return 'text-orange-700 bg-orange-50 border-orange-200';
      case 'com_log': return 'text-pink-700 bg-pink-50 border-pink-200';
      case 'rec_comp': return 'text-teal-700 bg-teal-50 border-teal-200';
      default: return 'text-slate-700';
    }
  };

  const getTypeLabel = (type: SessionType) => {
    switch(type) {
      case 'work': return 'Lavoro';
      case 'ord_2025': return 'Ord. 25';
      case 'ord_2026': return 'Ord. 26';
      case 'lic_937': return 'Lic. 937';
      case 'rec_fest': return 'Rec. Fest.';
      case 'com_log': return 'Com. Log.';
      case 'rec_comp': return 'Rec. Comp.';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      
      {/* Header - VIBRANT GRADIENT */}
      <header className="bg-gradient-to-r from-blue-700 to-indigo-800 border-b border-indigo-900/10 sticky top-0 z-20 shadow-md">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 backdrop-blur-sm p-1.5 rounded-lg text-white">
              <Clock size={20} strokeWidth={2.5} />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-white">MD JobTrack</h1>
          </div>
          <div className="text-xs font-semibold px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-full text-blue-50 border border-white/10">
            {todayLocale}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">

        {/* --- DASHBOARD VIEW --- */}
        {view === 'dashboard' && (
          <>
            {/* Horizontal Scroll Cards - VIVID GRADIENT CARDS */}
            <div className="overflow-x-auto pb-6 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory">
              <div className="flex gap-3">
                
                {/* 1. Ordinaria 2025 */}
                <div className="snap-center shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg shadow-blue-200 border border-blue-400/20 p-4 w-32 md:w-36 flex flex-col justify-between text-white relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-2xl"></div>
                  <div className="flex items-center gap-2 mb-3">
                    <Palmtree size={18} className="text-blue-100" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-50">Ord. 25</span>
                  </div>
                  <div className="relative z-10">
                    <div className="text-2xl font-bold text-white tracking-tight">{balanceOrd2025.toFixed(0)} <span className="text-sm opacity-80 font-medium">gg</span></div>
                    <div className="text-[10px] text-blue-100 mt-0.5">Su {settings.leaveBalances.ord_2025} gg</div>
                  </div>
                </div>

                {/* 2. Ordinaria 2026 */}
                <div className="snap-center shrink-0 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 border border-indigo-400/20 p-4 w-32 md:w-36 flex flex-col justify-between text-white relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-2xl"></div>
                  <div className="flex items-center gap-2 mb-3">
                    <Palmtree size={18} className="text-indigo-100" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-50">Ord. 26</span>
                  </div>
                  <div className="relative z-10">
                    <div className="text-2xl font-bold text-white tracking-tight">{balanceOrd2026.toFixed(0)} <span className="text-sm opacity-80 font-medium">gg</span></div>
                    <div className="text-[10px] text-indigo-100 mt-0.5">Su {settings.leaveBalances.ord_2026} gg</div>
                  </div>
                </div>

                {/* 3. Licenza 937 */}
                <div className="snap-center shrink-0 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg shadow-purple-200 border border-purple-400/20 p-4 w-32 md:w-36 flex flex-col justify-between text-white relative overflow-hidden">
                   <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-2xl"></div>
                  <div className="flex items-center gap-2 mb-3">
                    <Award size={18} className="text-purple-100" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-50">Lic. 937</span>
                  </div>
                  <div className="relative z-10">
                    <div className="text-2xl font-bold text-white tracking-tight">{balanceLic937.toFixed(0)} <span className="text-sm opacity-80 font-medium">gg</span></div>
                    <div className="text-[10px] text-purple-100 mt-0.5">Su {settings.leaveBalances.lic_937} gg</div>
                  </div>
                </div>

                {/* 4. Recupero Festività */}
                <div className="snap-center shrink-0 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-lg shadow-orange-200 border border-orange-400/20 p-4 w-32 md:w-36 flex flex-col justify-between text-white relative overflow-hidden">
                   <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-2xl"></div>
                  <div className="flex items-center gap-2 mb-3">
                    <RotateCcw size={18} className="text-orange-100" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-50">Rec. Fest.</span>
                  </div>
                  <div className="relative z-10">
                    <div className="text-2xl font-bold text-white tracking-tight">{balanceRecFest.toFixed(0)} <span className="text-sm opacity-80 font-medium">gg</span></div>
                    <div className="text-[10px] text-orange-100 mt-0.5">
                       Su {settings.leaveBalances.rec_fest} gg 
                       {earnedDays.rec_fest > 0 && <span className="bg-white/20 px-1 rounded ml-1 text-white font-bold">(+{earnedDays.rec_fest})</span>}
                    </div>
                  </div>
                </div>

                {/* 5. Com. Log (Hours) */}
                <div className="snap-center shrink-0 bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl shadow-lg shadow-pink-200 border border-pink-400/20 p-4 w-32 md:w-36 flex flex-col justify-between text-white relative overflow-hidden">
                   <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-2xl"></div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={18} className="text-pink-100" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-pink-50">Com. Log.</span>
                  </div>
                  <div className="relative z-10">
                    <div className="text-2xl font-bold text-white tracking-tight">{balanceComLog.toFixed(1)} <span className="text-sm opacity-80 font-medium">h</span></div>
                    <div className="text-[10px] text-pink-100 mt-0.5">Su {settings.leaveBalances.com_log || 0} h</div>
                  </div>
                </div>

              </div>
            </div>

            {/* Rec Comp (Monte Ore) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center relative overflow-hidden text-center w-full">
               <div className={`absolute top-0 left-0 w-full h-1.5 ${totalBalance >= 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
               <div className="flex items-center gap-2 text-slate-600 mb-2">
                <Briefcase size={22} />
                <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Rec comp.</span>
              </div>
              <div>
                <div className={`text-4xl font-bold ${totalBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {totalBalance > 0 ? '+' : ''}{totalBalance.toFixed(2)}h
                </div>
                <div className="text-xs text-slate-400 mt-1">Saldo Accumulato Totale</div>
              </div>
            </div>

            {/* Manual Entry Card */}
            <div className={`bg-white rounded-2xl shadow-sm border p-5 md:p-6 relative transition-colors duration-300 ${entryType === 'work' ? 'border-slate-200' : (entryType === 'com_log' ? 'border-pink-200 ring-1 ring-pink-50' : 'border-blue-200 ring-1 ring-blue-50')}`}>
              <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Plus size={20} className={entryType === 'work' ? "text-blue-600" : (entryType === 'com_log' ? "text-pink-600" : "text-indigo-600")} /> 
                {entryType === 'work' ? 'Registra Lavoro' : (entryType === 'com_log' ? 'Registra Com. Log.' : 'Registra Assenza')}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Tipo Attività</label>
                  {/* TEXT-BASE PREVENTS IOS ZOOM */}
                  <select 
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value as SessionType)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-base md:text-sm font-medium text-slate-700 appearance-none"
                  >
                    <option value="work">💼 Lavoro Ordinario</option>
                    <option value="com_log">📍 Com. Log. (h)</option>
                    <option disabled className="text-slate-300">--- Ferie e Permessi ---</option>
                    <option value="ord_2025">🌴 Ordinaria 2025 (gg)</option>
                    <option value="ord_2026">🌴 Ordinaria 2026 (gg)</option>
                    <option value="lic_937">🎖️ Licenza 937 (gg)</option>
                    <option value="rec_fest">🔄 Recupero Festività (gg)</option>
                    <option disabled className="text-slate-300">--- Straordinario ---</option>
                    <option value="rec_comp">⚡ Recupero Compensativo</option>
                  </select>
                </div>

                <div>
                   <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Data</label>
                   <input 
                    type="date" 
                    value={entryDate} 
                    onChange={e => setEntryDate(e.target.value)} 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-base md:text-sm font-medium text-slate-700"
                   />
                   {isEntryDateHoliday && (
                     <div className="text-xs text-orange-600 font-medium mt-1 flex items-center gap-1">
                       <Sparkles size={10} /> Giorno Festivo
                     </div>
                   )}
                </div>
                
                {entryType === 'work' || entryType === 'com_log' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Inizio</label>
                      <input 
                        type="time" 
                        value={entryStart} 
                        onChange={e => setEntryStart(e.target.value)} 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-base md:text-sm font-medium text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Fine</label>
                      <input 
                        type="time" 
                        value={entryEnd} 
                        onChange={e => setEntryEnd(e.target.value)} 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-base md:text-sm font-medium text-slate-700"
                      />
                    </div>
                  </div>
                ) : (
                  <div className={`flex items-center justify-center border rounded-lg font-medium text-sm p-3 ${entryType === 'rec_comp' ? 'bg-teal-50 border-teal-100 text-teal-700' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
                     <span className="flex items-center gap-2">
                       {entryType === 'rec_comp' ? <BatteryCharging size={16} /> : <Clock size={16} />}
                       {entryType === 'rec_comp' ? 'Assenza con Recupero Ore' : 'Intera Giornata'}
                     </span>
                  </div>
                )}
              </div>
              
              <div className="mb-5">
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Note / Descrizione</label>
                  <input 
                    type="text" 
                    value={entryActivity} 
                    onChange={e => setEntryActivity(e.target.value)}
                    placeholder={entryType === 'work' ? "Es. Sviluppo funzionalità..." : "Es. Riposo"} 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-base md:text-sm placeholder:text-slate-400"
                  />
              </div>
              
              <button 
                onClick={handleAddManualSession}
                className={`w-full text-white font-semibold py-3.5 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 
                  ${entryType === 'work' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 
                    entryType === 'com_log' ? 'bg-pink-600 hover:bg-pink-700 shadow-pink-200' :
                    entryType === 'rec_comp' ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-200' : 
                    'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
              >
                <Save size={18} /> {entryType === 'work' || entryType === 'com_log' ? 'Registra Ore' : 'Conferma Assenza'}
              </button>
            </div>

            {/* Stats Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <BarChart2 size={18} /> Grafico Settimanale
                </h2>
              </div>
              <WorkChart sessions={sessions} settings={settings} />
            </div>

            {/* Recent Sessions List */}
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Ultimi Movimenti</h3>
                <button 
                  onClick={generateReport}
                  disabled={isAiLoading}
                  className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                >
                  <Sparkles size={14} /> {isAiLoading ? 'Analisi...' : 'Report AI'}
                </button>
               </div>
               
               {aiReport && (
                 <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl text-sm text-purple-900 leading-relaxed mb-4 animate-in fade-in slide-in-from-top-2">
                   <h4 className="font-bold mb-1 flex items-center gap-2"><Sparkles size={12} /> Insight Gemini</h4>
                   {aiReport}
                 </div>
               )}

               <div className="space-y-3">
                {sessions.slice().reverse().slice(0, 3).map(session => (
                  <div key={session.id} className={`border rounded-xl p-3 md:p-4 flex flex-col gap-2 md:gap-3 transition-colors group ${getTypeColor(session.type)}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/50 border border-black/5 whitespace-nowrap`}>
                             {getTypeLabel(session.type)}
                          </span>
                        </div>
                        <div className="text-sm font-medium opacity-90 truncate">
                          {(session.type === 'work' || session.type === 'com_log') ? (
                            <>
                              {new Date(session.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                              {session.endTime ? new Date(session.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ' ...'}
                            </>
                          ) : (
                            <span>Giornata Intera</span>
                          )}
                        </div>
                        <div className="text-xs opacity-60 mt-0.5">
                          {new Date(session.startTime).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                         {(session.type === 'work' || session.type === 'com_log') && (
                           <span className="text-xs font-mono bg-white/50 px-2 py-1 rounded opacity-80 font-bold">
                             {session.endTime 
                               ? ((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60 * 60)).toFixed(2) + 'h'
                               : 'N/A'}
                           </span>
                         )}
                         {/* DELETE BUTTON: Visible on mobile (no hover), hover effect on desktop */}
                         <button onClick={() => handleDeleteSession(session.id)} className="text-slate-300 hover:text-red-600 transition-colors p-2">
                           <Trash2 size={16} />
                         </button>
                      </div>
                    </div>
                    
                    <div className="relative">
                       {editingSessionId === session.id ? (
                         <div className="space-y-2 mt-2">
                           <textarea
                             value={activityText}
                             onChange={(e) => setActivityText(e.target.value)}
                             placeholder="Modifica..."
                             className="w-full text-base md:text-sm p-3 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                             rows={2}
                             autoFocus
                           />
                           <div className="flex gap-2 justify-end">
                             {session.type === 'work' && (
                               <button 
                                 onClick={() => handleRefineWithAI(session.id)}
                                 disabled={isAiLoading || !activityText}
                                 className="text-xs bg-purple-100 text-purple-700 px-3 py-2 rounded-lg font-medium flex items-center gap-1 hover:bg-purple-200 disabled:opacity-50"
                               >
                                 <Sparkles size={12} /> AI
                               </button>
                             )}
                             <button 
                               onClick={() => handleSaveActivity(session.id)}
                               className="text-xs bg-blue-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-blue-700"
                             >
                               Salva
                             </button>
                           </div>
                         </div>
                       ) : (
                         <div 
                           onClick={() => {
                             setEditingSessionId(session.id);
                             setActivityText(session.activityRefined || session.activityRaw);
                           }}
                           className={`text-sm cursor-pointer hover:bg-white/50 p-2 -ml-2 rounded-lg transition-colors break-words ${!session.activityRefined && !session.activityRaw ? 'opacity-50 italic' : 'opacity-80'}`}
                         >
                           {session.activityRefined || session.activityRaw || "Nessuna nota"}
                         </div>
                       )}
                    </div>
                  </div>
                ))}
                {sessions.length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-sm">Nessuna registrazione presente.</div>
                )}
               </div>
            </div>
          </>
        )}

        {/* --- HISTORY VIEW --- */}
        {view === 'history' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6">
            <h2 className="font-bold text-lg mb-6 flex items-center gap-2"><Calendar size={20} /> Storico Completo</h2>
            <div className="space-y-8">
              {(() => {
                 // Group days by month
                 const days = [...sortedDays].reverse(); // Oldest to Newest
                 const groups: { month: string; days: string[] }[] = [];
                 
                 days.forEach(dayStr => {
                    const [d, m, y] = dayStr.split('/').map(Number);
                    const date = new Date(y, m-1, d);
                    const monthLabel = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
                    const capitalizedLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
                    
                    let lastGroup = groups[groups.length - 1];
                    if (!lastGroup || lastGroup.month !== capitalizedLabel) {
                        groups.push({ month: capitalizedLabel, days: [] });
                    }
                    if (groups[groups.length - 1]) {
                        groups[groups.length - 1].days.push(dayStr);
                    }
                 });

                 return groups.map(group => (
                   <div key={group.month}>
                     <div className="sticky top-16 bg-white/95 backdrop-blur z-10 py-2 border-b border-slate-100 mb-4">
                       <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                         <Calendar size={14} className="text-slate-400" />
                         {group.month}
                       </h3>
                     </div>
                     <div className="space-y-6">
                        {group.days.map(dayStr => {
                            const daysSessions = sessionsByDay[dayStr];
                            const dayTotal = daysSessions.reduce((acc, s) => {
                            if (s.type === 'work' && s.endTime) {
                                return acc + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / (1000 * 60 * 60);
                            }
                            return acc;
                            }, 0);
                            
                            const [d, m, y] = dayStr.split('/').map(Number);
                            const dateObj = new Date(y, m-1, d);
                            const target = DateService.getTargetHoursForDate(dateObj.toISOString(), settings);
                            
                            const hasFullDayLeave = daysSessions.some(s => ['ord_2025', 'ord_2026', 'lic_937', 'rec_fest'].includes(s.type));
                            const hasRecComp = daysSessions.some(s => s.type === 'rec_comp');
                            
                            let dailyCredited = 0;
                            daysSessions.forEach(s => {
                                if ((s.type === 'work' || s.type === 'com_log') && s.endTime) {
                                dailyCredited += (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / (1000 * 60 * 60);
                                }
                            });

                            let deltaDisplay = 0;
                            if (hasFullDayLeave) deltaDisplay = 0;
                            else if (hasRecComp) deltaDisplay = -target;
                            else deltaDisplay = dailyCredited - target;

                            const isHoliday = DateService.isHoliday(dateObj);

                            return (
                            <div key={dayStr} className="space-y-2">
                                <div className="flex flex-wrap items-center justify-between bg-slate-50 p-2 rounded-lg gap-2">
                                  <div className="flex items-center gap-2">
                                      <div className="font-semibold text-slate-700 text-sm">{dayStr}</div>
                                      {isHoliday && <span className="text-[10px] text-orange-600 font-bold px-1.5 py-0.5 bg-orange-100 rounded">FESTIVO</span>}
                                  </div>
                                  <div className="flex items-center gap-3 ml-auto">
                                      <span className={`text-xs font-bold ${deltaDisplay >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                      {deltaDisplay > 0 ? '+' : ''}{deltaDisplay.toFixed(2)}h
                                      </span>
                                      <span className="text-xs font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                                      Lav: {dayTotal.toFixed(2)}h
                                      </span>
                                  </div>
                                </div>

                                <div className="pl-2 md:pl-4 space-y-3 border-l-2 border-slate-100 ml-2">
                                {daysSessions.sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).map(session => (
                                    <div key={session.id} className="relative pb-1">
                                        <div className="flex justify-between mb-0.5">
                                        <span className="text-xs text-slate-500 font-medium flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${session.type === 'work' ? 'bg-slate-400' : (session.type === 'com_log' ? 'bg-pink-400' : 'bg-blue-400')}`}></span>
                                            {(session.type === 'work' || session.type === 'com_log') ? (
                                            <>
                                                {new Date(session.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                                                {session.endTime ? new Date(session.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                                            </>
                                            ) : (
                                            <span>Giornata Intera</span>
                                            )}
                                        </span>
                                        {session.type !== 'work' && (
                                            <span className={`text-[10px] uppercase font-bold px-1.5 rounded ${session.type === 'com_log' ? 'text-pink-600 bg-pink-50' : 'text-blue-600 bg-blue-50'}`}>{getTypeLabel(session.type)}</span>
                                        )}
                                        </div>
                                        <div className="text-sm text-slate-600 break-words">
                                        {session.activityRefined || session.activityRaw || <span className="text-slate-400 italic text-xs">Nessuna descrizione</span>}
                                        </div>
                                    </div>
                                ))}
                                </div>
                            </div>
                            );
                        })}
                     </div>
                   </div>
                 ));
              })()}
              {sessions.length === 0 && <div className="text-center text-slate-400 text-sm">Nessuno storico disponibile.</div>}
            </div>
          </div>
        )}

        {/* --- SETTINGS VIEW --- */}
        {view === 'settings' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <h2 className="font-bold text-lg flex items-center gap-2"><Settings size={20} /> Impostazioni</h2>
            
            <div className="space-y-4">
              <h3 className="font-medium text-slate-800 text-sm uppercase tracking-wide border-b pb-2">Orario di Lavoro Standard</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Lun - Gio</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={settings.schedule.monThu}
                      onChange={(e) => setSettings({...settings, schedule: {...settings.schedule, monThu: Number(e.target.value)}})}
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-base md:text-sm"
                    />
                    <span className="absolute right-3 top-3.5 text-slate-400 text-sm">h</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Venerdì</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={settings.schedule.fri}
                      onChange={(e) => setSettings({...settings, schedule: {...settings.schedule, fri: Number(e.target.value)}})}
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-base md:text-sm"
                    />
                    <span className="absolute right-3 top-3.5 text-slate-400 text-sm">h</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Weekend / Festivi</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={settings.schedule.satSun}
                      onChange={(e) => setSettings({...settings, schedule: {...settings.schedule, satSun: Number(e.target.value)}})}
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-base md:text-sm"
                    />
                    <span className="absolute right-3 top-3.5 text-slate-400 text-sm">h</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-slate-800 text-sm uppercase tracking-wide border-b pb-2">Plafond Ferie e Licenze (Giorni Iniziali)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Ordinaria 2025 (gg)</label>
                  <input 
                    type="number" 
                    value={settings.leaveBalances?.ord_2025 || 0}
                    onChange={(e) => setSettings({...settings, leaveBalances: {...settings.leaveBalances, ord_2025: Number(e.target.value)}})}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base md:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Ordinaria 2026 (gg)</label>
                  <input 
                    type="number" 
                    value={settings.leaveBalances?.ord_2026 || 0}
                    onChange={(e) => setSettings({...settings, leaveBalances: {...settings.leaveBalances, ord_2026: Number(e.target.value)}})}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base md:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Licenza 937 (gg)</label>
                  <input 
                    type="number" 
                    value={settings.leaveBalances?.lic_937 || 0}
                    onChange={(e) => setSettings({...settings, leaveBalances: {...settings.leaveBalances, lic_937: Number(e.target.value)}})}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base md:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Recupero Festività (gg)</label>
                  <input 
                    type="number" 
                    value={settings.leaveBalances?.rec_fest || 0}
                    onChange={(e) => setSettings({...settings, leaveBalances: {...settings.leaveBalances, rec_fest: Number(e.target.value)}})}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base md:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Com. Log. (h)</label>
                  <input 
                    type="number" 
                    value={settings.leaveBalances?.com_log || 0}
                    onChange={(e) => setSettings({...settings, leaveBalances: {...settings.leaveBalances, com_log: Number(e.target.value)}})}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base md:text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="font-medium text-slate-900 mb-2">Area Pericolo</h3>
              <button 
                onClick={() => {
                  if(confirm('Cancellare tutti i dati? Questa azione è irreversibile.')) {
                    setSessions([]);
                    Storage.saveSessions([]);
                  }
                }}
                className="text-red-600 text-sm hover:underline flex items-center gap-1 p-2"
              >
                <Trash2 size={16} /> Cancella tutti i dati
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 px-6 py-3 flex justify-between items-center z-20 md:hidden safe-area-pb shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setView('dashboard')}
          className={`flex flex-col items-center gap-1 text-[10px] font-medium p-2 rounded-xl transition-all active:scale-95 ${view === 'dashboard' ? 'text-blue-600 bg-blue-50 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Clock size={22} strokeWidth={view === 'dashboard' ? 2.5 : 2} /> Home
        </button>
        <button 
          onClick={() => setView('history')}
          className={`flex flex-col items-center gap-1 text-[10px] font-medium p-2 rounded-xl transition-all active:scale-95 ${view === 'history' ? 'text-blue-600 bg-blue-50 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Calendar size={22} strokeWidth={view === 'history' ? 2.5 : 2} /> Storico
        </button>
        <button 
          onClick={() => setView('settings')}
          className={`flex flex-col items-center gap-1 text-[10px] font-medium p-2 rounded-xl transition-all active:scale-95 ${view === 'settings' ? 'text-blue-600 bg-blue-50 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Settings size={22} strokeWidth={view === 'settings' ? 2.5 : 2} /> Opzioni
        </button>
      </nav>

      {/* Desktop Navigation Hints (Hidden on mobile) */}
      <div className="hidden md:flex fixed top-4 right-4 z-20 gap-2">
         <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${view === 'dashboard' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Dashboard</button>
         <button onClick={() => setView('history')} className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${view === 'history' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Storico</button>
         <button onClick={() => setView('settings')} className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${view === 'settings' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Opzioni</button>
      </div>

    </div>
  );
};

export default App;