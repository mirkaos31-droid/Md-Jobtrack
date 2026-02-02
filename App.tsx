
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Save, Clock, Calendar, BarChart2, Settings, Sparkles, Trash2, Info, Briefcase, Palmtree, Award, RotateCcw, BatteryCharging, FileText, Upload, Image as ImageIcon, MapPin, UserCheck, Pencil, X, ArrowRight, Check, Loader2, Banknote, Wallet, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { WorkSession, UserSettings, SessionType, SalaryEntry } from './types';
import * as Storage from './services/storageService';
import * as GeminiService from './services/geminiService';
import * as DateService from './services/dateService';
import WorkChart from './components/WorkChart';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [salaries, setSalaries] = useState<SalaryEntry[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ 
    schedule: { monThu: 8.5, fri: 4, satSun: 0 },
    leaveBalances: {}
  });
  
  const [view, setView] = useState<'dashboard' | 'history' | 'operations' | 'settings' | 'salary'>('dashboard');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
  
  const [entryDate, setEntryDate] = useState(new Date().toLocaleDateString('fr-CA'));
  const [entryStart, setEntryStart] = useState('08:00');
  const [entryEnd, setEntryEnd] = useState('16:30');
  const [entryType, setEntryType] = useState<SessionType>('work');
  const [entryActivity, setEntryActivity] = useState('');

  const [opStartDate, setOpStartDate] = useState(new Date().toLocaleDateString('fr-CA'));
  const [opEndDate, setOpEndDate] = useState(new Date().toLocaleDateString('fr-CA'));
  const [opLocation, setOpLocation] = useState('');

  const [salaryDate, setSalaryDate] = useState(new Date().toLocaleDateString('fr-CA'));
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryNote, setSalaryNote] = useState('');

  // History View State
  const [expandedYear, setExpandedYear] = useState<number | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ date: string; startTime: string; endTime: string; activity: string; } | null>(null);
  const [activityText, setActivityText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  useEffect(() => {
    let loadedSessions = Storage.loadSessions();
    const loadedSalaries = Storage.loadSalaries();
    let loadedSettings = Storage.loadSettings();

    // 1. 5-Year Auto-Cleanup
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const recentSessions = loadedSessions.filter(s => new Date(s.startTime) >= fiveYearsAgo);
    
    // Save immediately if data was cleaned
    if (recentSessions.length !== loadedSessions.length) {
       loadedSessions = recentSessions;
       Storage.saveSessions(loadedSessions);
       console.log("Auto-cleanup: Removed sessions older than 5 years.");
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const balances = { ...loadedSettings.leaveBalances };
    const used = DateService.calculateUsedLeave(loadedSessions);
    let changed = false;

    // Automatically add current year if missing, with default 39 days
    if (balances[`ord_${currentYear}`] === undefined) {
      balances[`ord_${currentYear}`] = 39;
      changed = true;
    }

    Object.keys(balances).forEach(key => {
      if (key.startsWith('ord_')) {
        const year = parseInt(key.split('_')[1]);
        const initial = balances[key];
        
        // Remove past years if exhausted
        if (year < currentYear) {
          const spent = used[key] || 0;
          if (initial - spent <= 0) {
            delete balances[key];
            changed = true;
          }
        }
        
        // Remove future years if they are 0
        if (year > currentYear && initial === 0) {
          delete balances[key];
          changed = true;
        }
      }
    });

    if (changed) {
      loadedSettings = { ...loadedSettings, leaveBalances: balances };
      Storage.saveSettings(loadedSettings);
    }

    setSessions(loadedSessions);
    setSettings(loadedSettings);
    setSalaries(loadedSalaries);
    
    // Set default expanded year to current year
    setExpandedYear(currentYear);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    Storage.saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    Storage.saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    Storage.saveSalaries(salaries);
  }, [salaries]);

  const handleAddManualSession = async () => {
    if (!entryDate) return;
    let startDateTime: Date;
    let endDateTime: Date;

    if (entryType === 'work' || entryType === 'com_log') {
      if (!entryStart || !entryEnd) return;
      startDateTime = new Date(`${entryDate}T${entryStart}`);
      endDateTime = new Date(`${entryDate}T${entryEnd}`);
      if (endDateTime <= startDateTime) { alert("Errore orari"); return; }
    } else if (entryType === 'rec_comp') {
       startDateTime = new Date(`${entryDate}T09:00:00`);
       endDateTime = new Date(`${entryDate}T09:00:00`);
    } else {
      const targetHours = DateService.getTargetHoursForDate(entryDate, settings);
      startDateTime = new Date(`${entryDate}T09:00:00`);
      endDateTime = new Date(startDateTime.getTime() + targetHours * 60 * 60 * 1000);
    }

    setSaveStatus('saving');
    const newSession: WorkSession = {
      id: crypto.randomUUID(),
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      type: entryType,
      activityRaw: entryActivity,
      activityRefined: entryActivity,
      tags: []
    };

    await new Promise(r => setTimeout(r, 400));
    setSessions(prev => [...prev, newSession]);
    setSaveStatus('success');
    setEntryActivity('');
    setTimeout(() => setSaveStatus('idle'), 2000);
    
    if (entryActivity && entryType === 'work') {
       setIsAiLoading(true);
       try {
         const refined = await GeminiService.refineActivityText(entryActivity);
         setSessions(prev => prev.map(s => s.id === newSession.id ? { ...s, activityRefined: refined } : s));
       } catch(e) {}
       setIsAiLoading(false);
    }
  };

  const handleAddOperation = () => {
    if (!opStartDate || !opEndDate || !opLocation) return;
    const start = new Date(opStartDate);
    const end = new Date(opEndDate);
    if (end < start) return;
    const newSessions: WorkSession[] = [];
    let loopDate = new Date(start);
    while (loopDate <= end) {
        const dateStr = loopDate.toLocaleDateString('fr-CA');
        newSessions.push({
            id: crypto.randomUUID(),
            startTime: new Date(`${dateStr}T08:00:00`).toISOString(),
            endTime: new Date(`${dateStr}T17:00:00`).toISOString(),
            type: 'operation',
            activityRaw: opLocation,
            activityRefined: opLocation,
            tags: ['operation']
        });
        loopDate.setDate(loopDate.getDate() + 1);
    }
    setSessions(prev => [...prev, ...newSessions]);
    setOpLocation('');
  };

  const handleAddSalary = () => {
    if (!salaryAmount || !salaryDate) return;
    setSalaries(prev => [...prev, { id: crypto.randomUUID(), date: salaryDate, amount: parseFloat(salaryAmount), note: salaryNote }]);
    setSalaryAmount('');
    setSalaryNote('');
  };

  const handleDeleteSession = (id: string) => {
    if (confirm("Eliminare?")) setSessions(prev => prev.filter(s => s.id !== id));
  };

  const todayLocaleFormatted = currentDate.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
  const totalBalance = DateService.calculateTotalBalance(sessions, settings);
  const usedLeave = DateService.calculateUsedLeave(sessions);
  const earnedDays = DateService.calculateEarnedDays(sessions);
  
  const ordinariaKeys = Object.keys(settings.leaveBalances)
    .filter(k => k.startsWith('ord_'))
    .sort((a, b) => a.localeCompare(b));

  const currentYearNum = new Date().getFullYear();
  const prevYearKey = `ord_${currentYearNum - 1}`;

  const getTypeLabel = (type: string) => {
    if (type.startsWith('ord_')) return `Ord. ${type.split('_')[1].slice(-2)}`;
    const map: Record<string, string> = { work:'Lavoro', lic_937:'Lic. 937', rec_fest:'Rec. Fest.', com_log:'Com. Log.', rec_comp:'Rec. Comp.', operation:'Operazione' };
    return map[type] || type;
  };

  const getTypeColor = (type: string) => {
    if (type.startsWith('ord_')) return 'text-blue-700 bg-blue-50 border-blue-200';
    const map: Record<string, string> = { work:'text-slate-700 bg-slate-50 border-slate-200', lic_937:'text-purple-700 bg-purple-50 border-purple-200', rec_fest:'text-orange-700 bg-orange-50 border-orange-200', com_log:'text-pink-700 bg-pink-50 border-pink-200', rec_comp:'text-teal-700 bg-teal-50 border-teal-200', operation:'text-emerald-700 bg-emerald-50 border-emerald-200' };
    return map[type] || 'text-slate-700';
  };

  // Grouping Logic for History
  const historyData = useMemo(() => {
    const grouped: Record<number, Record<number, WorkSession[]>> = {};
    
    sessions.forEach(session => {
        const date = new Date(session.startTime);
        const year = date.getFullYear();
        const month = date.getMonth();
        
        if (!grouped[year]) grouped[year] = {};
        if (!grouped[year][month]) grouped[year][month] = [];
        grouped[year][month].push(session);
    });

    return grouped;
  }, [sessions]);

  const sortedYears = Object.keys(historyData).map(Number).sort((a, b) => b - a);

  return (
    <div className="min-h-screen bg-slate-100 pb-20 md:pb-0">
      <header className="bg-gradient-to-r from-blue-700 to-indigo-800 border-b border-indigo-900/10 sticky top-0 z-20 shadow-lg">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 backdrop-blur-sm p-1.5 rounded-lg text-white">
              <Clock size={20} strokeWidth={2.5} />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-white">WorkLog</h1>
          </div>
          <div className="text-xs font-semibold px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-full text-blue-50 border border-white/10">{todayLocaleFormatted}</div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        {view === 'dashboard' && (
          <>
            <div className="overflow-x-auto pb-6 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory">
              <div className="flex gap-3">
                {ordinariaKeys.map((key, idx) => {
                  const initial = settings.leaveBalances[key] || 0;
                  const spent = usedLeave[key] || 0;
                  const balance = initial - spent;
                  const colors = [
                    'from-blue-600 to-blue-700 shadow-blue-200/50',
                    'from-indigo-600 to-indigo-700 shadow-indigo-200/50',
                    'from-cyan-600 to-cyan-700 shadow-cyan-200/50'
                  ];
                  return (
                    <div key={key} className={`snap-center shrink-0 bg-gradient-to-br ${colors[idx % colors.length]} rounded-2xl shadow-md border border-white/10 p-4 w-32 md:w-36 flex flex-col justify-between text-white relative overflow-hidden`}>
                      <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-2xl"></div>
                      <div className="flex items-center gap-2 mb-3">
                        <Palmtree size={18} className="text-white/70" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{getTypeLabel(key)}</span>
                      </div>
                      <div className="relative z-10">
                        <div className="text-2xl font-bold">{balance.toFixed(0)} <span className="text-sm opacity-80 font-medium">gg</span></div>
                        <div className="text-[10px] opacity-70">Su {initial} gg</div>
                      </div>
                    </div>
                  );
                })}

                <div className="snap-center shrink-0 bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl shadow-md shadow-purple-200/50 p-4 w-32 md:w-36 flex flex-col justify-between text-white relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-3"><Award size={18}/><span className="text-[10px] font-bold uppercase">Lic. 937</span></div>
                  <div><div className="text-2xl font-bold">{(settings.leaveBalances.lic_937 - (usedLeave.lic_937 || 0)).toFixed(0)} <span className="text-sm opacity-80">gg</span></div></div>
                </div>

                <div className="snap-center shrink-0 bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl shadow-md shadow-orange-200/50 p-4 w-32 md:w-36 flex flex-col justify-between text-white relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-3"><RotateCcw size={18}/><span className="text-[10px] font-bold uppercase">Rec. Fest.</span></div>
                  <div><div className="text-2xl font-bold">{(settings.leaveBalances.rec_fest + earnedDays.rec_fest - (usedLeave.rec_fest || 0)).toFixed(0)} <span className="text-sm opacity-80">gg</span></div></div>
                </div>

                <div className="snap-center shrink-0 bg-gradient-to-br from-pink-600 to-pink-700 rounded-2xl shadow-md shadow-pink-200/50 p-4 w-32 md:w-36 flex flex-col justify-between text-white relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-3"><MapPin size={18}/><span className="text-[10px] font-bold uppercase">Com. Log.</span></div>
                  <div><div className="text-2xl font-bold">{(settings.leaveBalances.com_log - (usedLeave.com_log || 0)).toFixed(0)} <span className="text-sm opacity-80">h</span></div>
                  <div className="text-[10px] opacity-70">Su {settings.leaveBalances.com_log} h</div></div>
                </div>

              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 flex flex-col items-center justify-center text-center">
               <div className={`w-full h-1.5 rounded-full mb-4 ${totalBalance >= 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
               <div className="flex items-center gap-2 text-slate-500 mb-1"><Briefcase size={20}/><span className="text-sm font-bold uppercase tracking-widest">Monte Ore</span></div>
               <div className={`text-4xl font-black ${totalBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>{totalBalance > 0 ? '+' : ''}{totalBalance.toFixed(2)}h</div>
            </div>

            <div className="bg-white rounded-3xl shadow-md border border-slate-200 p-6 space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="bg-blue-50 text-blue-600 p-2 rounded-xl"><Plus size={20}/></div>
                <h3 className="font-bold text-slate-800">Nuova Registrazione</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Tipo Attività</label>
                  <select value={entryType} onChange={e => setEntryType(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
                    <option value="work">💼 Lavoro</option>
                    <option value="com_log">📍 Com. Log.</option>
                    {ordinariaKeys.map(k => <option key={k} value={k}>🌴 {getTypeLabel(k)}</option>)}
                    <option value="lic_937">🎖️ Licenza 937</option>
                    <option value="rec_fest">🔄 Rec. Festività</option>
                    <option value="rec_comp">⚡ Rec. Compensativo</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Data</label><input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"/></div>
                  {(entryType === 'work' || entryType === 'com_log') ? (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="time" value={entryStart} onChange={e => setEntryStart(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"/>
                      <input type="time" value={entryEnd} onChange={e => setEntryEnd(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"/>
                    </div>
                  ) : <div className="flex items-center justify-center text-xs font-bold text-blue-600 bg-blue-50 rounded-xl px-4">Intera Giornata</div>}
                </div>
                <input type="text" value={entryActivity} onChange={e => setEntryActivity(e.target.value)} placeholder="Cosa hai fatto oggi?" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"/>
                <button onClick={handleAddManualSession} disabled={saveStatus !== 'idle'} className={`w-full py-4 rounded-2xl text-white font-bold transition-all shadow-lg ${saveStatus === 'success' ? 'bg-green-500' : 'bg-blue-600 active:scale-95 shadow-blue-200'}`}>
                  {saveStatus === 'saving' ? <Loader2 className="animate-spin mx-auto"/> : saveStatus === 'success' ? <Check className="mx-auto"/> : 'Salva Registrazione'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6"><WorkChart sessions={sessions} settings={settings}/></div>
          </>
        )}

        {view === 'salary' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
               <div className="flex items-center gap-2 mb-4 opacity-80"><Wallet size={20}/> <span className="text-xs font-bold uppercase tracking-widest">Totale Quest'anno</span></div>
               <div className="text-4xl font-black">€ {salaries.filter(s => new Date(s.date).getFullYear() === new Date().getFullYear()).reduce((acc, s) => acc + s.amount, 0).toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-md border border-amber-100 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={salaryDate} onChange={e => setSalaryDate(e.target.value)} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"/>
                <input type="number" value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} placeholder="Importo €" className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"/>
              </div>
              <input type="text" value={salaryNote} onChange={e => setSalaryNote(e.target.value)} placeholder="Note (es. Bonus)" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"/>
              <button onClick={handleAddSalary} className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl active:scale-95 transition-all shadow-md shadow-amber-200">Registra Cash</button>
            </div>
            <div className="space-y-3">
              {salaries.sort((a,b) => b.date.localeCompare(a.date)).map(s => (
                <div key={s.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase">{new Date(s.date).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</div>
                    <div className="text-lg font-bold text-amber-600">€ {s.amount.toFixed(2)}</div>
                  </div>
                  <button onClick={() => setSalaries(prev => prev.filter(x => x.id !== s.id))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'operations' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
               <div className="flex items-center gap-2 mb-4 opacity-80"><MapPin size={20}/> <span className="text-xs font-bold uppercase tracking-widest">Totale Missioni</span></div>
               <div className="text-4xl font-black">{sessions.filter(s => s.type === 'operation').length}</div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-md border border-emerald-100 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={opStartDate} onChange={e => setOpStartDate(e.target.value)} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"/>
                <input type="date" value={opEndDate} onChange={e => setOpEndDate(e.target.value)} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"/>
              </div>
              <input type="text" value={opLocation} onChange={e => setOpLocation(e.target.value)} placeholder="Luogo Missione" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"/>
              <button onClick={handleAddOperation} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl active:scale-95 transition-all shadow-md shadow-emerald-200">Salva Operazione</button>
            </div>
            <div className="space-y-3">
              {sessions.filter(s => s.type === 'operation').slice().reverse().map(op => (
                <div key={op.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase">{new Date(op.startTime).toLocaleDateString('it-IT')}</div>
                    <div className="text-sm font-bold text-emerald-700">{op.activityRaw}</div>
                  </div>
                  <button onClick={() => handleDeleteSession(op.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'history' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 px-2 text-slate-800"><Calendar size={22} className="text-blue-600"/> Storico Completo</h2>
            
            <div className="bg-slate-800 rounded-2xl p-6 text-white shadow-lg flex justify-between items-center mb-6 mx-2">
               <div>
                  <div className="text-xs font-bold uppercase opacity-50 mb-1">Giorni di Presenza (Totale)</div>
                  <div className="text-3xl font-black">{new Set(sessions.filter(s => ['work', 'operation', 'com_log'].includes(s.type)).map(s => new Date(s.startTime).toLocaleDateString())).size}</div>
               </div>
               <UserCheck size={32} className="text-blue-400 opacity-50"/>
            </div>

            {sortedYears.map(year => {
              const yearData = historyData[year];
              const sortedMonths = Object.keys(yearData).map(Number).sort((a, b) => b - a);
              const isYearExpanded = expandedYear === year;

              return (
                <div key={year} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                  <div 
                    onClick={() => setExpandedYear(isYearExpanded ? null : year)}
                    className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-100"
                  >
                    <div className="text-lg font-bold text-slate-700">{year}</div>
                    <div className="text-slate-400">{isYearExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}</div>
                  </div>

                  {isYearExpanded && (
                    <div className="p-4 space-y-3">
                      {sortedMonths.map(month => {
                        const monthSessions = yearData[month];
                        const monthName = new Date(year, month).toLocaleDateString('it-IT', { month: 'long' }).replace(/^\w/, c => c.toUpperCase());
                        const presenceCount = new Set(monthSessions.filter(s => ['work', 'operation', 'com_log'].includes(s.type)).map(s => new Date(s.startTime).toLocaleDateString())).size;
                        const monthKey = `${year}-${month}`;
                        const isMonthExpanded = expandedMonth === monthKey;

                        return (
                          <div key={month} className="border border-slate-200 rounded-2xl overflow-hidden">
                             <div 
                                onClick={() => setExpandedMonth(isMonthExpanded ? null : monthKey)}
                                className="flex items-center justify-between p-4 bg-white cursor-pointer hover:bg-blue-50/30 transition-colors"
                             >
                                <div className="flex items-center gap-3">
                                   <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${presenceCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                                     {presenceCount}
                                   </div>
                                   <div>
                                      <div className="font-bold text-slate-800">{monthName}</div>
                                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Presenze</div>
                                   </div>
                                </div>
                                <div className="text-slate-300">
                                   {isMonthExpanded ? <ChevronUp size={18}/> : <ChevronRight size={18}/>}
                                </div>
                             </div>

                             {isMonthExpanded && (
                               <div className="bg-slate-50/50 border-t border-slate-100 p-3 space-y-2">
                                 {monthSessions
                                   .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                                   .map(s => (
                                     <div key={s.id} className={`p-3 rounded-xl border ${getTypeColor(s.type)} bg-white shadow-sm flex justify-between items-center`}>
                                        <div>
                                          <div className="flex items-center gap-2 mb-1">
                                            <div className="text-[10px] font-black uppercase text-slate-400">{new Date(s.startTime).toLocaleDateString('it-IT', { day: 'numeric', weekday: 'short' })}</div>
                                            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                            <div className="text-[10px] font-black uppercase">{getTypeLabel(s.type)}</div>
                                          </div>
                                          <div className="text-sm font-medium leading-tight">{s.activityRefined || s.activityRaw || "Nessuna nota"}</div>
                                        </div>
                                        {s.endTime && (
                                          <div className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">
                                            {((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 3600000).toFixed(1)}h
                                          </div>
                                        )}
                                     </div>
                                 ))}
                               </div>
                             )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            
            {sortedYears.length === 0 && (
                <div className="text-center py-10 text-slate-400">Nessun dato nello storico.</div>
            )}
            
            <div className="text-center text-[10px] text-slate-400 py-4">
               I dati antecedenti a 5 anni fa vengono eliminati automaticamente.
            </div>
          </div>
        )}

        {view === 'settings' && (
           <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-8 shadow-md">
             <h2 className="text-xl font-bold flex items-center gap-2"><Settings size={22} className="text-blue-600"/> Impostazioni</h2>
             
             <section className="space-y-4">
               <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest border-b pb-2">Bilanci Ferie</h3>
               <div className="grid grid-cols-2 gap-4">
                 {ordinariaKeys.map(k => (
                   <div key={k}>
                     <label className="block text-[10px] font-bold text-slate-600 mb-1">{getTypeLabel(k)} (gg)</label>
                     <input type="number" value={settings.leaveBalances[k]} onChange={e => setSettings({...settings, leaveBalances: {...settings.leaveBalances, [k]: parseInt(e.target.value)||0}})} className="w-full p-3 bg-slate-50 border rounded-xl text-sm"/>
                   </div>
                 ))}
                 
                 {!settings.leaveBalances[prevYearKey] && (
                    <button 
                        onClick={() => setSettings(prev => ({...prev, leaveBalances: {...prev.leaveBalances, [prevYearKey]: 0}}))} 
                        className="border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-400 font-bold text-xs hover:border-blue-300 hover:text-blue-500 transition-all p-3"
                    >
                        <Plus size={16}/> Aggiungi Ord. {currentYearNum - 1}
                    </button>
                 )}

                 <div><label className="block text-[10px] font-bold text-slate-600 mb-1">Licenza 937 (gg)</label><input type="number" value={settings.leaveBalances.lic_937} onChange={e => setSettings({...settings, leaveBalances: {...settings.leaveBalances, lic_937: parseInt(e.target.value)||0}})} className="w-full p-3 bg-slate-50 border rounded-xl text-sm"/></div>
                 <div><label className="block text-[10px] font-bold text-slate-600 mb-1">Com. Log (h)</label><input type="number" value={settings.leaveBalances.com_log} onChange={e => setSettings({...settings, leaveBalances: {...settings.leaveBalances, com_log: parseInt(e.target.value)||0}})} className="w-full p-3 bg-slate-50 border rounded-xl text-sm"/></div>
                 <div><label className="block text-[10px] font-bold text-slate-600 mb-1">Monte Ore Iniziale (h)</label><input type="number" value={settings.leaveBalances.rec_comp} onChange={e => setSettings({...settings, leaveBalances: {...settings.leaveBalances, rec_comp: parseInt(e.target.value)||0}})} className="w-full p-3 bg-slate-50 border rounded-xl text-sm"/></div>
               </div>
             </section>
             <button onClick={() => { if(confirm('Svuotare tutto?')) setSessions([]); Storage.saveSessions([]); }} className="text-red-500 text-xs font-bold flex items-center gap-1 hover:underline"><Trash2 size={14}/> Reset Totale Database</button>
           </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 pb-safe pt-2 flex justify-between items-end z-30 md:hidden h-20 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
        <div className="flex justify-around w-full pb-2">
            <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1 text-[10px] font-bold p-2 transition-all ${view === 'dashboard' ? 'text-blue-600' : 'text-slate-400'}`}><Clock size={20}/> Home</button>
            <button onClick={() => setView('operations')} className={`flex flex-col items-center gap-1 text-[10px] font-bold p-2 transition-all ${view === 'operations' ? 'text-emerald-600' : 'text-slate-400'}`}><MapPin size={20}/> Op.</button>
        </div>
        <div className="relative w-20 flex justify-center z-40">
           <button onClick={() => setView('salary')} className={`absolute -top-20 w-16 h-16 rounded-full flex flex-col items-center justify-center text-white shadow-2xl border-[4px] border-white transition-all active:scale-90 ${view === 'salary' ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-amber-400 to-orange-500'}`}><Banknote size={24}/><span className="text-[10px] font-black mt-0.5">Cash</span></button>
        </div>
        <div className="flex justify-around w-full pb-2">
            <button onClick={() => setView('history')} className={`flex flex-col items-center gap-1 text-[10px] font-bold p-2 transition-all ${view === 'history' ? 'text-blue-600' : 'text-slate-400'}`}><Calendar size={20}/> Storico</button>
            <button onClick={() => setView('settings')} className={`flex flex-col items-center gap-1 text-[10px] font-bold p-2 transition-all ${view === 'settings' ? 'text-blue-600' : 'text-slate-400'}`}><Settings size={20}/> Opz.</button>
        </div>
      </nav>

      <div className="hidden md:flex fixed top-4 right-4 z-20 gap-2">
         {['dashboard', 'operations', 'salary', 'history', 'settings'].map((v: any) => (
           <button key={v} onClick={() => setView(v)} className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${view === v ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>{v === 'salary' ? 'Cash' : v === 'dashboard' ? 'Home' : v}</button>
         ))}
      </div>
    </div>
  );
};

export default App;
