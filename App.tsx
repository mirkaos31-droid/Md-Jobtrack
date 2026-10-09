
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Save, Clock, Calendar, BarChart2, Settings, Sparkles, Trash2, Info, Briefcase, Palmtree, Award, RotateCcw, BatteryCharging, FileText, Upload, Image as ImageIcon, MapPin, UserCheck, Pencil, X, ArrowRight, Check, Loader2, Banknote, Wallet, ChevronDown, ChevronRight, ChevronUp, CheckCircle2 } from 'lucide-react';
import { WorkSession, UserSettings, SessionType, MoneyTransaction } from './types';
import * as Storage from './services/storageService';
import * as DateService from './services/dateService';
import WorkChart from './components/WorkChart';
import MyMoney from './components/MyMoney';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [transactions, setTransactions] = useState<MoneyTransaction[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ 
    schedule: { monThu: 8.5, fri: 4, satSun: 0 },
    leaveBalances: {}
  });
  
  const [view, setView] = useState<'dashboard' | 'history' | 'operations' | 'settings' | 'mymoney'>('dashboard');
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

  // History View State
  const [expandedYear, setExpandedYear] = useState<number | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ date: string; startTime: string; endTime: string; activity: string; } | null>(null);
  const [activityText, setActivityText] = useState('');

  useEffect(() => {
    let loadedSessions = Storage.loadSessions();
    const loadedTransactions = Storage.loadTransactions();
    let loadedSettings = Storage.loadSettings();
    const loadedDraft = Storage.loadDraft();

    setTransactions(loadedTransactions);

    if (loadedDraft) {
      if (loadedDraft.entryStart) setEntryStart(loadedDraft.entryStart);
      if (loadedDraft.entryEnd) setEntryEnd(loadedDraft.entryEnd);
      if (loadedDraft.entryType) setEntryType(loadedDraft.entryType);
      if (loadedDraft.entryActivity) setEntryActivity(loadedDraft.entryActivity);
    }

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

  // Dynamic Theme (Light during day, Dark at night)
  useEffect(() => {
    const checkTheme = () => {
      const hour = new Date().getHours();
      const isNight = hour >= 18 || hour < 6;
      if (isNight) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    checkTheme();
    const interval = setInterval(checkTheme, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Storage.saveDraft({ entryDate, entryStart, entryEnd, entryType, entryActivity });
  }, [entryDate, entryStart, entryEnd, entryType, entryActivity]);

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
    
    let finalType = entryType;
    if (entryType === 'work' && entryEnd > '16:30') {
      finalType = 'servizio';
    }

    const newSession: WorkSession = {
      id: crypto.randomUUID(),
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      type: finalType,
      activityRaw: entryActivity,
      activityRefined: entryActivity,
      tags: []
    };

    await new Promise(r => setTimeout(r, 400));
    setSessions(prev => [...prev, newSession]);
    setSaveStatus('success');
    setEntryActivity('');
    setEntryStart('08:00');
    setEntryEnd('16:30');
    setEntryDate(new Date().toLocaleDateString('fr-CA'));
    setEntryType('work');
    setTimeout(() => setSaveStatus('idle'), 2000);
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

  const handleSaveTransactions = (updated: MoneyTransaction[]) => {
    setTransactions(updated);
    Storage.saveTransactions(updated);
  };

  const handleDeleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    setSessionToDelete(null);
  };

  const todayLocaleFormatted = currentDate.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
  const totalBalance = DateService.calculateTotalBalance(sessions, settings);
  const usedLeave = DateService.calculateUsedLeave(sessions);
  const earnedDays = DateService.calculateEarnedDays(sessions, settings);
  
  const currentYearNum = new Date().getFullYear();

  const ordinariaKeys = Object.keys(settings.leaveBalances)
    .filter(k => {
      if (!k.startsWith('ord_')) return false;
      const year = parseInt(k.split('_')[1]);
      const initial = settings.leaveBalances[k] || 0;
      const spent = usedLeave[k] || 0;
      return (initial - spent) > 0 || year >= currentYearNum;
    })
    .sort((a, b) => a.localeCompare(b));

  const settingsOrdKeys = Object.keys(settings.leaveBalances)
    .filter(k => k.startsWith('ord_'))
    .sort((a, b) => a.localeCompare(b));

  const existingYears = settingsOrdKeys
    .map(k => parseInt(k.split('_')[1]))
    .filter(y => !isNaN(y));
  const minExistingYear = existingYears.length > 0 ? Math.min(...existingYears) : currentYearNum;
  const nextPastYearToAdd = minExistingYear <= currentYearNum ? minExistingYear - 1 : currentYearNum - 1;
  const nextPastYearKey = `ord_${nextPastYearToAdd}`;

  const getTypeLabel = (type: string) => {
    if (type.startsWith('ord_')) return `Ord. ${type.split('_')[1].slice(-2)}`;
    const map: Record<string, string> = { work:'Lavoro', servizio:'Servizio', lic_937:'Lic. 937', rec_fest:'Rec. Fest.', com_log:'Com. Log.', rec_comp:'Rec. Comp.', operation:'Operazione' };
    return map[type] || type;
  };

  const summaryCards = useMemo(() => {
    const list: Array<{
      key: string;
      label: string;
      icon: React.ComponentType<{ size?: number; className?: string }>;
      unit: string;
      balance: number;
      initial: number;
      earned?: number;
      subtitle: string;
      borderClass: string;
      badgeClass: string;
      numClass: string;
      isZero: boolean;
      sortOrder: number;
    }> = [];

    // 1. Ordinarie
    const ordKeys = Object.keys(settings.leaveBalances)
      .filter(k => {
        if (!k.startsWith('ord_')) return false;
        const year = parseInt(k.split('_')[1]);
        const initial = settings.leaveBalances[k] || 0;
        const spent = usedLeave[k] || 0;
        return initial > 0 || spent > 0 || year >= currentYearNum;
      })
      .sort((a, b) => a.localeCompare(b));

    ordKeys.forEach((k, idx) => {
      const initial = settings.leaveBalances[k] || 0;
      const spent = usedLeave[k] || 0;
      const balance = Math.max(0, initial - spent);
      const isZero = balance <= 0;
      const year = k.split('_')[1];

      let borderClass = 'border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]';
      let badgeClass = 'bg-cyan-500/20 border-cyan-400/40 text-cyan-400';
      let numClass = 'text-cyan-300';

      if (year === '2026' || year === '26') {
        borderClass = 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]';
        badgeClass = 'bg-blue-500/20 border-blue-400/40 text-blue-400';
        numClass = 'text-blue-300';
      } else if (year === '2024' || year === '24') {
        borderClass = 'border-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.2)]';
        badgeClass = 'bg-teal-500/20 border-teal-400/40 text-teal-400';
        numClass = 'text-teal-300';
      } else if (year !== '2025' && year !== '25') {
        borderClass = 'border-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.2)]';
        badgeClass = 'bg-sky-500/20 border-sky-400/40 text-sky-400';
        numClass = 'text-sky-300';
      }

      list.push({
        key: k,
        label: getTypeLabel(k),
        icon: Palmtree,
        unit: 'gg',
        balance,
        initial,
        subtitle: isZero ? `0 su ${initial} gg` : `Su ${initial} gg`,
        borderClass,
        badgeClass,
        numClass,
        isZero,
        sortOrder: 10 + idx
      });
    });

    // 2. Lic. 937
    const licInitial = settings.leaveBalances.lic_937 || 0;
    const licSpent = usedLeave.lic_937 || 0;
    const licBalance = Math.max(0, licInitial - licSpent);
    const licZero = licBalance <= 0;
    list.push({
      key: 'lic_937',
      label: 'Lic. 937',
      icon: Award,
      unit: 'gg',
      balance: licBalance,
      initial: licInitial,
      subtitle: licZero ? `0 su ${licInitial} gg` : `Su ${licInitial} gg`,
      borderClass: 'border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.2)]',
      badgeClass: 'bg-fuchsia-500/20 border-fuchsia-400/40 text-fuchsia-400',
      numClass: 'text-fuchsia-300',
      isZero: licZero,
      sortOrder: 30
    });

    // 3. Rec. Fest.
    const recFestInitial = settings.leaveBalances.rec_fest || 0;
    const recFestEarned = earnedDays.rec_fest || 0;
    const recFestSpent = usedLeave.rec_fest || 0;
    const recFestBalance = Math.max(0, recFestInitial + recFestEarned - recFestSpent);
    const recFestZero = recFestBalance <= 0;
    list.push({
      key: 'rec_fest',
      label: 'Rec. Fest.',
      icon: RotateCcw,
      unit: 'gg',
      balance: recFestBalance,
      initial: recFestInitial,
      earned: recFestEarned,
      subtitle: recFestEarned > 0 ? `+${recFestEarned} mat. / Iniz. ${recFestInitial}` : (recFestZero ? `0 su ${recFestInitial} gg` : `Mat. + Iniziale`),
      borderClass: 'border-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.2)]',
      badgeClass: 'bg-orange-500/20 border-orange-400/40 text-orange-400',
      numClass: 'text-orange-300',
      isZero: recFestZero,
      sortOrder: 40
    });

    // 4. Com. Log.
    const comLogInitial = settings.leaveBalances.com_log || 0;
    const comLogEarned = earnedDays.com_log || 0;
    const comLogSpent = usedLeave.com_log || 0;
    const comLogBalance = Math.max(0, comLogInitial + comLogEarned - comLogSpent);
    const comLogZero = comLogBalance <= 0;
    list.push({
      key: 'com_log',
      label: 'Com. Log.',
      icon: MapPin,
      unit: 'h',
      balance: comLogBalance,
      initial: comLogInitial,
      earned: comLogEarned,
      subtitle: comLogEarned > 0 ? `+${comLogEarned} mat. / Iniz. ${comLogInitial}` : (comLogZero ? `0 su ${comLogInitial} h` : `Su ${comLogInitial} h`),
      borderClass: 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.2)]',
      badgeClass: 'bg-rose-500/20 border-rose-400/40 text-rose-400',
      numClass: 'text-rose-300',
      isZero: comLogZero,
      sortOrder: 50
    });

    // 5. Rec. Comp. (if configured)
    const recCompInitial = settings.leaveBalances.rec_comp || 0;
    const recCompSpent = usedLeave.rec_comp || 0;
    if (recCompInitial > 0 || recCompSpent > 0) {
      const recCompBalance = Math.max(0, recCompInitial - recCompSpent);
      const recCompZero = recCompBalance <= 0;
      list.push({
        key: 'rec_comp',
        label: 'Rec. Comp.',
        icon: Clock,
        unit: 'h',
        balance: recCompBalance,
        initial: recCompInitial,
        subtitle: recCompZero ? `0 su ${recCompInitial} h` : `Su ${recCompInitial} h`,
        borderClass: 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]',
        badgeClass: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-400',
        numClass: 'text-emerald-300',
        isZero: recCompZero,
        sortOrder: 60
      });
    }

    return list;
  }, [settings.leaveBalances, usedLeave, earnedDays, currentYearNum]);

  const activeSummaryCards = useMemo(() => {
    return summaryCards
      .filter(c => !c.isZero)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [summaryCards]);

  const zeroSummaryCards = useMemo(() => {
    return summaryCards
      .filter(c => c.isZero)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [summaryCards]);

  const displayedSummaryCards = useMemo(() => {
    return [...activeSummaryCards, ...zeroSummaryCards];
  }, [activeSummaryCards, zeroSummaryCards]);

  const getTypeColor = (type: string) => {
    if (type.startsWith('ord_')) {
      const year = type.split('_')[1];
      if (year === '2025' || year === '25') return 'text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-300 dark:bg-cyan-950/40 dark:border-cyan-800/40';
      if (year === '2026' || year === '26') return 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-800/40';
      if (year === '2024' || year === '24') return 'text-teal-700 bg-teal-50 border-teal-200 dark:text-teal-300 dark:bg-teal-950/40 dark:border-teal-800/40';
      return 'text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-950/40 dark:border-sky-800/40';
    }
    const map: Record<string, string> = { 
      work:'text-slate-700 bg-slate-100 border-slate-300 dark:text-slate-300 dark:bg-slate-800/60 dark:border-slate-700', 
      servizio:'text-violet-700 bg-violet-50 border-violet-200 dark:text-violet-300 dark:bg-violet-950/40 dark:border-violet-800/40', 
      lic_937:'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200 dark:text-fuchsia-300 dark:bg-fuchsia-950/40 dark:border-fuchsia-800/40', 
      rec_fest:'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950/40 dark:border-orange-800/40', 
      com_log:'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/40 dark:border-rose-800/40', 
      rec_comp:'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800/40', 
      operation:'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800/40' 
    };
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

  const getSessionHoursDisplay = (s: WorkSession) => {
    if (s.type === 'rec_comp') {
      const target = DateService.getTargetHoursForDate(s.startTime, settings);
      return <span className="text-red-500 font-bold">-{target.toFixed(1)}h</span>;
    }
    
    if (!s.endTime) return null;
    
    if (s.type === 'servizio') {
       const start = new Date(s.startTime);
       const end = new Date(s.endTime);
       const day = start.getDay();
       const isHol = DateService.isHoliday(start);
       
       if (isHol || day === 0 || day === 6) {
           return ((end.getTime() - start.getTime()) / 3600000).toFixed(1) + 'h';
       }
       
       const threshold = new Date(start);
       if (day === 5) {
           threshold.setHours(12, 0, 0, 0);
       } else {
           threshold.setHours(16, 30, 0, 0);
       }
       
       const validStart = Math.max(start.getTime(), threshold.getTime());
       const diff = end.getTime() - validStart;
       if (diff > 0) {
           return (diff / 3600000).toFixed(1) + 'h';
       }
       return '0.0h';
    }
    
    return ((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 3600000).toFixed(1) + 'h';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-mesh-dark dark:bg-[#020617] text-slate-800 dark:text-slate-200 pb-20 md:pb-0 font-sans selection:bg-cyan-500/30 transition-colors duration-500">
      <header className="glass-card border-b border-indigo-900/10 dark:border-white/10 sticky top-0 z-20 shadow-lg dark:shadow-xl transition-all duration-500">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600/10 dark:bg-cyan-500/20 shadow-[0_0_15px_rgba(37,99,235,0.2)] dark:shadow-[0_0_15px_rgba(6,182,212,0.4)] backdrop-blur-sm p-1.5 rounded-lg text-blue-600 dark:text-cyan-400 border border-blue-600/20 dark:border-cyan-500/30">
              <Clock size={20} className="dark:drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" strokeWidth={2.5} />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-800 dark:text-white drop-shadow-sm dark:drop-shadow-md">JobTrack</h1>
          </div>
          <div className="text-xs font-semibold px-2.5 py-1 bg-black/5 dark:bg-white/5 backdrop-blur-md rounded-full text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/10 shadow-inner">{todayLocaleFormatted}</div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6 relative z-10">
        {view === 'dashboard' && (
          <>
            {/* Dynamic Leave Balances Carousel: Minimal, Compact & Automatic */}
            <div className="overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory">
              <div className="flex gap-2.5 items-stretch py-0.5">
                {displayedSummaryCards.map((card, idx) => {
                  const IconComponent = card.icon;
                  const isFirstZero = card.isZero && (!displayedSummaryCards[idx - 1] || !displayedSummaryCards[idx - 1].isZero);

                  return (
                    <React.Fragment key={card.key}>
                      {/* Subtle thin separator when zeroed cards begin */}
                      {isFirstZero && activeSummaryCards.length > 0 && (
                        <div className="shrink-0 flex items-center px-0.5">
                          <div className="w-[1px] h-10 bg-slate-800" />
                        </div>
                      )}

                      {card.isZero ? (
                        /* Zeroed / Exhausted Card (automatically shifted to right, minimal & compact) */
                        <div 
                          className="snap-center shrink-0 rounded-xl px-3 py-2 w-28 bg-slate-900/40 border border-slate-800 flex flex-col justify-between text-white relative transition-all duration-200 opacity-50 hover:opacity-90"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 truncate" style={{ fontFamily: "'Plus Jakarta Sans', 'Outfit', sans-serif" }}>
                              {card.label}
                            </span>
                            <span className="text-[9px] font-bold text-slate-600">
                              0
                            </span>
                          </div>
                          <div>
                            <div className="text-lg font-extrabold font-mono tracking-tight text-slate-500">
                              0 <span className="text-[10px] font-semibold text-slate-600">{card.unit}</span>
                            </div>
                            <div className="text-[9px] text-slate-600 truncate mt-0.5 font-medium">
                              {card.subtitle}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Active Card: Compact, solid contour, vibrant */
                        <div 
                          className={`snap-center shrink-0 rounded-xl px-3 py-2 w-28 bg-slate-900 border-2 ${card.borderClass} flex flex-col justify-between text-white relative transition-all duration-200 hover:scale-[1.02] shadow-sm`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 truncate" style={{ fontFamily: "'Plus Jakarta Sans', 'Outfit', sans-serif" }}>
                              {card.label}
                            </span>
                            <div className={`p-1 rounded-md border ${card.badgeClass}`}>
                              <IconComponent size={12} />
                            </div>
                          </div>
                          <div>
                            <div className={`text-xl font-black font-mono tracking-tight leading-none ${card.numClass}`}>
                              {card.balance.toFixed(0)} <span className="text-[11px] font-semibold opacity-70">{card.unit}</span>
                            </div>
                            <div className="text-[9px] text-slate-400 font-medium truncate mt-1">
                              {card.subtitle}
                            </div>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Monte Ore Card: Modern, Compact with Solid Contours & Large Numbers */}
            <div className={`relative overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-900 p-4 sm:p-5 text-white border-2 transition-all ${
              totalBalance >= 0 
                ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.22)]' 
                : 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.22)]'
            }`}>
              <div className={`absolute -right-8 -bottom-8 w-40 h-40 rounded-full blur-2xl pointer-events-none ${
                totalBalance >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'
              }`}></div>
              
              <div className="relative z-10 flex flex-col justify-between">
                {/* Header Row */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                      totalBalance >= 0 
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' 
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                    }`}>
                      <Briefcase size={15} />
                    </div>
                    <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-slate-200" style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}>
                      Monte Ore
                    </span>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border shrink-0 ${
                    totalBalance >= 0 
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  }`}>
                    {totalBalance >= 0 ? 'Attivo' : 'Disavanzo'}
                  </span>
                </div>
                
                {/* Big numbers below the label */}
                <div className={`text-3xl sm:text-4xl font-black font-mono tracking-tight my-0.5 ${
                  totalBalance >= 0 
                    ? 'text-emerald-400 drop-shadow-[0_0_14px_rgba(52,211,153,0.35)]' 
                    : 'text-rose-400 drop-shadow-[0_0_14px_rgba(244,63,94,0.35)]'
                }`}>
                  {totalBalance > 0 ? '+' : ''}{totalBalance.toFixed(2)} h
                </div>
                
                {/* Info subtitle */}
                <div className="text-[11px] text-slate-400 mt-1 font-medium">
                  Bilancio orario cumulativo rispetto al debito di servizio
                </div>
              </div>
            </div>

            {/* Nuova Registrazione Card: Solid Contours, Sleek Form & Matching Button */}
            <div className="rounded-2xl sm:rounded-3xl bg-slate-900 border-2 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.18)] p-4 sm:p-5 text-white space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border bg-indigo-500/20 border-indigo-400/40 text-indigo-300">
                    <Plus size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wide text-slate-100" style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}>
                      Nuova Registrazione
                    </h3>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded-md border border-indigo-400/30">
                  Inserimento rapido
                </span>
              </div>

              <div className="space-y-3.5">
                <div className="min-w-0">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 truncate">Tipo Attività</label>
                  <select 
                    value={entryType} 
                    onChange={e => setEntryType(e.target.value as SessionType)} 
                    className="w-full min-w-0 p-2.5 sm:p-3 bg-slate-950/80 border-2 border-slate-700/90 rounded-xl text-sm font-semibold text-white focus:border-indigo-400 outline-none appearance-none transition-colors"
                  >
                    <option value="work">💼 Lavoro</option>
                    <option value="com_log">📍 Com. Log.</option>
                    {ordinariaKeys.map(k => <option key={k} value={k}>🌴 {getTypeLabel(k)}</option>)}
                    <option value="lic_937">🎖️ Licenza 937</option>
                    <option value="rec_fest">🔄 Rec. Festività</option>
                    <option value="rec_comp">⚡ Rec. Compensativo</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 truncate">Data</label>
                    <input 
                      type="date" 
                      value={entryDate} 
                      onChange={e => setEntryDate(e.target.value)} 
                      className="w-full min-w-0 p-2.5 sm:p-3 bg-slate-950/80 border-2 border-slate-700/90 rounded-xl text-sm font-semibold text-white outline-none focus:border-indigo-400 transition-colors"
                    />
                  </div>
                  {(entryType === 'work' || entryType === 'com_log') ? (
                    <div className="flex gap-2.5 min-w-0">
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 truncate">Inizio</label>
                        <input 
                          type="time" 
                          value={entryStart} 
                          onChange={e => setEntryStart(e.target.value)} 
                          className="w-full min-w-0 p-2.5 sm:p-3 bg-slate-950/80 border-2 border-slate-700/90 rounded-xl text-sm font-bold text-white outline-none focus:border-indigo-400 transition-colors text-center"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 truncate">Fine</label>
                        <input 
                          type="time" 
                          value={entryEnd} 
                          onChange={e => setEntryEnd(e.target.value)} 
                          className="w-full min-w-0 p-2.5 sm:p-3 bg-slate-950/80 border-2 border-slate-700/90 rounded-xl text-sm font-bold text-white outline-none focus:border-indigo-400 transition-colors text-center"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 opacity-0 hidden sm:block">Durata</label>
                      <div className="flex h-[42px] sm:h-[46px] items-center justify-center text-xs sm:text-sm font-bold text-indigo-300 bg-indigo-500/15 border-2 border-indigo-500/40 rounded-xl px-4 truncate">
                        Intera Giornata
                      </div>
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 truncate">Note / Attività</label>
                  <input 
                    type="text" 
                    value={entryActivity} 
                    onChange={e => setEntryActivity(e.target.value)} 
                    placeholder="Cosa hai fatto oggi?" 
                    className="w-full min-w-0 p-2.5 sm:p-3 bg-slate-950/80 border-2 border-slate-700/90 rounded-xl text-sm font-medium text-white placeholder-slate-500 outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>

                <button 
                  onClick={handleAddManualSession} 
                  disabled={saveStatus !== 'idle'} 
                  className={`w-full py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs sm:text-sm transition-all shadow-lg active:scale-[0.98] border border-indigo-400/30 flex items-center justify-center gap-2 ${
                    saveStatus === 'success' 
                      ? 'bg-emerald-500 text-white shadow-emerald-500/30' 
                      : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-500 text-white shadow-[0_0_18px_rgba(99,102,241,0.25)]'
                  }`}
                >
                  {saveStatus === 'saving' ? (
                    <><Loader2 size={16} className="animate-spin" /> Salvataggio in corso...</>
                  ) : saveStatus === 'success' ? (
                    <><Check size={16} /> Registrazione Salvata!</>
                  ) : (
                    <><Save size={16} /> Salva Registrazione</>
                  )}
                </button>
              </div>
            </div>

            {/* Andamento Ore Card: Solid Contours & Modern Header */}
            <div className="rounded-2xl sm:rounded-3xl bg-slate-900 border-2 border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.18)] p-4 sm:p-5 text-white transition-all">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border bg-indigo-500/20 border-indigo-400/40 text-indigo-300">
                    <BarChart2 size={15} />
                  </div>
                  <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-slate-200" style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}>
                    Andamento Ore & Attività
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 shrink-0">
                  Ultimi 7 Giorni
                </span>
              </div>
              <WorkChart sessions={sessions} settings={settings}/>
            </div>
          </>
        )}

        {view === 'mymoney' && (
          <MyMoney 
            transactions={transactions} 
            onSaveTransactions={handleSaveTransactions} 
          />
        )}

        {view === 'operations' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
               <div className="flex items-center gap-2 mb-4 opacity-80"><MapPin size={20}/> <span className="text-xs font-bold uppercase tracking-widest">Totale Missioni</span></div>
               <div className="text-4xl font-black">{sessions.filter(s => s.type === 'operation').length}</div>
            </div>
            <div className="glass-card bg-white dark:bg-slate-800/80 rounded-3xl p-6 shadow-md border border-emerald-100 dark:border-white/10 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={opStartDate} onChange={e => setOpStartDate(e.target.value)} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"/>
                <input type="date" value={opEndDate} onChange={e => setOpEndDate(e.target.value)} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"/>
              </div>
              <input type="text" value={opLocation} onChange={e => setOpLocation(e.target.value)} placeholder="Luogo Missione" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"/>
              <button onClick={handleAddOperation} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl active:scale-95 transition-all shadow-md shadow-emerald-200">Salva Operazione</button>
            </div>
            <div className="space-y-3">
              {sessions.filter(s => s.type === 'operation').slice().reverse().map(op => (
                <div key={op.id} className="glass-card bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-100 dark:border-white/5 flex justify-between items-center shadow-sm">
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase">{new Date(op.startTime).toLocaleDateString('it-IT')}</div>
                    <div className="text-sm font-bold text-emerald-700">{op.activityRaw}</div>
                  </div>
                  <button onClick={() => setSessionToDelete(op.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
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
                  <div className="text-3xl font-black">{new Set(sessions.filter(s => ['work', 'servizio', 'operation', 'com_log'].includes(s.type)).map(s => new Date(s.startTime).toLocaleDateString())).size}</div>
               </div>
               <UserCheck size={32} className="text-blue-400 opacity-50"/>
            </div>

            {sortedYears.map(year => {
              const yearData = historyData[year];
              const sortedMonths = Object.keys(yearData).map(Number).sort((a, b) => b - a);
              const isYearExpanded = expandedYear === year;

              return (
                <div key={year} className="bg-white dark:bg-slate-800/80 rounded-3xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
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
                        const presenceCount = new Set(monthSessions.filter(s => ['work', 'servizio', 'operation', 'com_log'].includes(s.type)).map(s => new Date(s.startTime).toLocaleDateString())).size;
                        const monthKey = `${year}-${month}`;
                        const isMonthExpanded = expandedMonth === monthKey;

                        return (
                          <div key={month} className="border border-slate-200 rounded-2xl overflow-hidden">
                             <div 
                                onClick={() => setExpandedMonth(isMonthExpanded ? null : monthKey)}
                                className="flex items-center justify-between p-4 bg-white dark:bg-transparent cursor-pointer hover:bg-blue-50/30 dark:hover:bg-white/5 transition-colors"
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
                                     <div key={s.id} className={`p-3 rounded-xl border ${getTypeColor(s.type)} bg-white dark:bg-slate-800/50 shadow-sm flex justify-between items-center`}>
                                        <div>
                                          <div className="flex items-center gap-2 mb-1">
                                            <div className="text-[10px] font-black uppercase text-slate-400">{new Date(s.startTime).toLocaleDateString('it-IT', { day: 'numeric', weekday: 'short' })}</div>
                                            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                            <div className="text-[10px] font-black uppercase">{getTypeLabel(s.type)}</div>
                                          </div>
                                          <div className="text-sm font-medium leading-tight">{s.activityRefined || s.activityRaw || "Nessuna nota"}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {s.endTime && (
                                            <div className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded whitespace-nowrap flex items-center">
                                              {getSessionHoursDisplay(s)}
                                            </div>
                                          )}
                                          <button onClick={() => setSessionToDelete(s.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                            <Trash2 size={16}/>
                                          </button>
                                        </div>
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
           <div className="glass-card bg-white dark:bg-slate-800/80 rounded-3xl p-6 border border-slate-200 dark:border-white/10 space-y-8 shadow-md">
             <h2 className="text-xl font-bold flex items-center gap-2"><Settings size={22} className="text-blue-600"/> Impostazioni</h2>
             
             <section className="space-y-4">
               <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest border-b border-slate-200 dark:border-slate-700 pb-2">Bilanci Ferie</h3>
               <div className="grid grid-cols-2 gap-4">
                 {settingsOrdKeys.map(k => {
                   const year = parseInt(k.split('_')[1]);
                   const isPastYear = !isNaN(year) && year < currentYearNum;
                   return (
                     <div key={k} className="relative">
                       <div className="flex items-center justify-between mb-1">
                         <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate">{getTypeLabel(k)} (gg)</label>
                         {isPastYear && (
                           <button
                             type="button"
                             onClick={() => {
                               setSettings(prev => {
                                 const nextBalances = { ...prev.leaveBalances };
                                 delete nextBalances[k];
                                 return { ...prev, leaveBalances: nextBalances };
                               });
                             }}
                             title="Rimuovi questo anno"
                             className="text-slate-400 hover:text-red-500 transition-colors p-0.5"
                           >
                             <Trash2 size={13}/>
                           </button>
                         )}
                       </div>
                       <input 
                         type="number" 
                         value={settings.leaveBalances[k] !== undefined ? settings.leaveBalances[k] : 0} 
                         onChange={e => setSettings({...settings, leaveBalances: {...settings.leaveBalances, [k]: parseInt(e.target.value)||0}})} 
                         className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-cyan-500 transition-colors"
                       />
                     </div>
                   );
                 })}
                 
                 {settings.leaveBalances[nextPastYearKey] === undefined && (
                    <button 
                        type="button"
                        onClick={() => setSettings(prev => ({...prev, leaveBalances: {...prev.leaveBalances, [nextPastYearKey]: 0}}))} 
                        className="border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500 font-bold text-xs hover:border-cyan-300 dark:hover:border-cyan-500/50 hover:text-cyan-500 transition-all p-3 min-h-[58px]"
                    >
                        <Plus size={16}/> Aggiungi Ord. {nextPastYearToAdd}
                    </button>
                 )}

                 <div><label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">Licenza 937 (gg)</label><input type="number" value={settings.leaveBalances.lic_937 || 0} onChange={e => setSettings({...settings, leaveBalances: {...settings.leaveBalances, lic_937: parseInt(e.target.value)||0}})} className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-cyan-500 transition-colors"/></div>
                 <div><label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">Rec. Fest. Iniziale (gg)</label><input type="number" value={settings.leaveBalances.rec_fest || 0} onChange={e => setSettings({...settings, leaveBalances: {...settings.leaveBalances, rec_fest: parseInt(e.target.value)||0}})} className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-cyan-500 transition-colors"/></div>
                 <div><label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">Com. Log (h)</label><input type="number" value={settings.leaveBalances.com_log || 0} onChange={e => setSettings({...settings, leaveBalances: {...settings.leaveBalances, com_log: parseInt(e.target.value)||0}})} className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-cyan-500 transition-colors"/></div>
                 <div><label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">Monte Ore Iniziale (h)</label><input type="number" value={settings.leaveBalances.rec_comp || 0} onChange={e => setSettings({...settings, leaveBalances: {...settings.leaveBalances, rec_comp: parseInt(e.target.value)||0}})} className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-cyan-500 transition-colors"/></div>
               </div>
             </section>

             <section className="space-y-4">
               <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest border-b border-slate-200 dark:border-slate-700 pb-2">Assistente IA</h3>
               <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 text-center">
                  <p className="text-xs text-slate-500 font-medium">L'analisi IA è stata disattivata per mantenere l'app indipendente e senza costi. Tutti i tuoi dati restano salvati in locale nel tuo dispositivo.</p>
               </div>
             </section>

             <button onClick={() => setResetConfirm(true)} className="text-red-500 text-xs font-bold flex items-center gap-1 hover:underline"><Trash2 size={14}/> Reset Totale Database</button>
           </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 w-full glass-card border-t border-white/10 px-2 pb-safe pt-2 flex justify-between items-end z-30 md:hidden h-20">
        <div className="flex justify-around w-full pb-2">
            <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1 text-[10px] font-bold p-2 transition-all ${view === 'dashboard' ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'text-slate-400'}`}><Clock size={20}/> Home</button>
            <button onClick={() => setView('operations')} className={`flex flex-col items-center gap-1 text-[10px] font-bold p-2 transition-all ${view === 'operations' ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'text-slate-400'}`}><MapPin size={20}/> Op.</button>
        </div>
        <div className="relative w-20 flex justify-center z-40">
           <button onClick={() => setView('mymoney')} className={`absolute -top-20 w-16 h-16 rounded-full flex flex-col items-center justify-center text-white shadow-[0_0_20px_rgba(16,185,129,0.5)] border-[3px] border-slate-900 transition-all active:scale-90 ${view === 'mymoney' ? 'bg-gradient-to-br from-emerald-400 to-indigo-600 scale-105' : 'bg-gradient-to-br from-emerald-500 to-indigo-700 opacity-90'}`}><Wallet size={22}/><span className="text-[9px] font-black mt-0.5 whitespace-nowrap">My Money</span></button>
        </div>
        <div className="flex justify-around w-full pb-2">
            <button onClick={() => setView('history')} className={`flex flex-col items-center gap-1 text-[10px] font-bold p-2 transition-all ${view === 'history' ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'text-slate-400'}`}><Calendar size={20}/> Storico</button>
            <button onClick={() => setView('settings')} className={`flex flex-col items-center gap-1 text-[10px] font-bold p-2 transition-all ${view === 'settings' ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'text-slate-400'}`}><Settings size={20}/> Opz.</button>
        </div>
      </nav>

      <div className="hidden md:flex fixed top-4 right-4 z-20 gap-2">
         {['dashboard', 'operations', 'mymoney', 'history', 'settings'].map((v: any) => (
           <button key={v} onClick={() => setView(v)} className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${view === v ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'glass-button text-slate-300'}`}>{v === 'mymoney' ? 'My Money' : v === 'dashboard' ? 'Home' : v}</button>
         ))}
      </div>
      {sessionToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Elimina Registrazione</h3>
            <p className="text-slate-500 mb-6">Sei sicuro di voler eliminare questa registrazione? L'azione non può essere annullata.</p>
            <div className="flex gap-3">
              <button onClick={() => setSessionToDelete(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl active:scale-95 transition-all">Annulla</button>
              <button onClick={() => handleDeleteSession(sessionToDelete)} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl active:scale-95 transition-all shadow-md shadow-red-200">Elimina</button>
            </div>
          </div>
        </div>
      )}

      {resetConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Reset Database</h3>
            <p className="text-slate-500 mb-6">Sei sicuro di voler svuotare tutto il database? Questa azione eliminerà tutte le registrazioni e non può essere annullata.</p>
            <div className="flex gap-3">
              <button onClick={() => setResetConfirm(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl active:scale-95 transition-all">Annulla</button>
              <button onClick={() => { setSessions([]); Storage.saveSessions([]); setResetConfirm(false); }} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl active:scale-95 transition-all shadow-md shadow-red-200">Svuota Tutto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
