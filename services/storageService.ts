
import { WorkSession, UserSettings, SalaryEntry } from '../types';

const SESSIONS_KEY = 'jobtrack_sessions';
const SETTINGS_KEY = 'jobtrack_settings';
const SALARIES_KEY = 'jobtrack_salaries';

const currentYear = new Date().getFullYear();
const DEFAULT_SETTINGS: UserSettings = {
  schedule: { monThu: 8.5, fri: 4, satSun: 0 },
  leaveBalances: {
    [`ord_${currentYear}`]: 39,
    lic_937: 0,
    rec_fest: 0,
    com_log: 0,
    rec_comp: 0
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

export const loadSalaries = (): SalaryEntry[] => {
  try {
    const data = localStorage.getItem(SALARIES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
};

export const saveSalaries = (salaries: SalaryEntry[]) => {
  localStorage.setItem(SALARIES_KEY, JSON.stringify(salaries));
};
