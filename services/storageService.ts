
import { WorkSession, UserSettings, SalaryEntry, MoneyTransaction } from '../types';

const SESSIONS_KEY = 'jobtrack_sessions';
const SETTINGS_KEY = 'jobtrack_settings';
const SALARIES_KEY = 'jobtrack_salaries';
const TRANSACTIONS_KEY = 'jobtrack_money_transactions';

const currentYear = new Date().getFullYear();
const DEFAULT_SETTINGS: UserSettings = {
  schedule: { monThu: 8.5, fri: 4, satSun: 0 },
  leaveBalances: {
    [`ord_${currentYear}`]: 39,
    lic_937: 0,
    rec_fest: 0,
    com_log: 0,
    rec_comp: 0
  },
  categoryBudgets: {
    casa_bollette: 500,
    spesa_cibo: 350,
    svago_tempo_libero: 200,
    trasporti_auto: 150,
    abbonamenti: 50
  }
};

export const loadSessions = (): WorkSession[] => {
  try {
    const data = localStorage.getItem(SESSIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
};

export const saveSessions = (sessions: WorkSession[]) => {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
};

export const loadSettings = (): UserSettings => {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (!data) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(data);
    return { ...DEFAULT_SETTINGS, ...parsed, leaveBalances: { ...DEFAULT_SETTINGS.leaveBalances, ...(parsed.leaveBalances || {}) } };
  } catch (e) { return DEFAULT_SETTINGS; }
};

export const saveSettings = (settings: UserSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const loadTransactions = (): MoneyTransaction[] => {
  try {
    const data = localStorage.getItem(TRANSACTIONS_KEY);
    if (data) {
      return JSON.parse(data);
    }
    
    // Migration: Check if old salary entries exist
    const oldSalariesData = localStorage.getItem(SALARIES_KEY);
    if (oldSalariesData) {
      const oldSalaries: SalaryEntry[] = JSON.parse(oldSalariesData);
      const migrated: MoneyTransaction[] = oldSalaries.map(s => ({
        id: s.id || crypto.randomUUID(),
        date: s.date,
        amount: s.amount,
        type: 'income',
        category: 'stipendio',
        title: s.note || 'Stipendio / Accredito Lavoro',
        note: s.note,
        isRecurring: true
      }));
      if (migrated.length > 0) {
        localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
    return [];
  } catch (e) { 
    return []; 
  }
};

export const saveTransactions = (transactions: MoneyTransaction[]) => {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
};

export const loadSalaries = (): SalaryEntry[] => {
  try {
    const data = localStorage.getItem(SALARIES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
};

export const saveSalaries = (salaries: SalaryEntry[]) => {
  localStorage.setItem(SALARIES_KEY, JSON.stringify(salaries));
};

export const loadDraft = () => {
  try {
    const data = localStorage.getItem('jobtrack_draft');
    return data ? JSON.parse(data) : null;
  } catch (e) { return null; }
};

export const saveDraft = (draft: any) => {
  if (!draft) localStorage.removeItem('jobtrack_draft');
  else localStorage.setItem('jobtrack_draft', JSON.stringify(draft));
};
