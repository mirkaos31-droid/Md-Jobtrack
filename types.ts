export type SessionType = 'work' | 'ord_2025' | 'ord_2026' | 'lic_937' | 'rec_fest' | 'rec_comp' | 'com_log';

export interface WorkSession {
  id: string;
  startTime: string; // ISO string
  endTime: string | null; // ISO string
  type: SessionType; // New field to distinguish work from leave
  activityRaw: string;
  activityRefined: string;
  tags: string[];
}

export interface DailyStat {
  date: string; // YYYY-MM-DD
  totalHours: number;
  expectedHours: number;
  overtime: number; // Can be negative
}

export interface ScheduleSettings {
  monThu: number; // Target hours for Mon-Thu
  fri: number;    // Target hours for Fri
  satSun: number; // Target hours for Sat-Sun
}

export interface LeaveBalances {
  ord_2025: number; // Initial budget in DAYS
  ord_2026: number; // Initial budget in DAYS
  lic_937: number;  // Initial budget in DAYS
  rec_fest: number; // Initial budget in DAYS
  com_log: number;  // Initial budget in HOURS
}

export interface UserSettings {
  schedule: ScheduleSettings;
  leaveBalances: LeaveBalances; // Added balances
  hourlyRate?: number;
}