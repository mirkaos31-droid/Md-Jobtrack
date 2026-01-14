import { WorkSession, UserSettings, SalaryEntry } from '../types';

const SESSIONS_KEY = 'jobtrack_sessions';
const SETTINGS_KEY = 'jobtrack_settings';
const SALARIES_KEY = 'jobtrack_salaries';

// Default schedule: Mon-Thu 8.5h (08:00-16:30), Fri 4h (08:00-12:00), Weekend 0
const DEFAULT_SETTINGS: UserSettings = {
  schedule: {
    monThu: 8.5,
    fri: 4,
    satSun: 0
  },
  leaveBalances: {
    ord_2025: 0,
    ord_2026: 0,
    lic_937: 0,
    rec_fest: 0,
    com_log: 0,
    rec_comp: 0
  },
  logoUrl: undefined
};

export const loadSessions = (): WorkSession[] => {
  try {
    const data = localStorage.getItem(SESSIONS_KEY);
    const sessions = data ? JSON.parse(data) : [];
    // Migration for existing sessions without type
    return sessions.map((s: any) => ({
      ...s,
      type: s.type || 'work'
    }));
  } catch (e) {
    console.error("Failed to load sessions", e);
    return [];
  }
};

export const saveSessions = (sessions: WorkSession[]) => {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
};

export const loadSettings = (): UserSettings => {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (!data) return DEFAULT_SETTINGS;
    
    const parsed = JSON.parse(data);
    
    // Merge with defaults to ensure new fields (like leaveBalances, logoUrl) exist
    return { 
      ...DEFAULT_SETTINGS, 
      ...parsed,
      leaveBalances: { ...DEFAULT_SETTINGS.leaveBalances, ...(parsed.leaveBalances || {}) }
    };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: UserSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const loadSalaries = (): SalaryEntry[] => {
  try {
    const data = localStorage.getItem(SALARIES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load salaries", e);
    return [];
  }
};

export const saveSalaries = (salaries: SalaryEntry[]) => {
  localStorage.setItem(SALARIES_KEY, JSON.stringify(salaries));
};