
export type SessionType = 'work' | 'lic_937' | 'rec_fest' | 'rec_comp' | 'com_log' | 'operation' | string;

export interface WorkSession {
  id: string;
  startTime: string; // ISO string
  endTime: string | null; // ISO string
  type: SessionType;
  activityRaw: string;
  activityRefined: string;
  tags: string[];
}

export interface SalaryEntry {
  id: string;
  date: string; // ISO string (YYYY-MM-DD)
  amount: number;
  note?: string;
}

export interface UserSettings {
  schedule: {
    monThu: number;
    fri: number;
    satSun: number;
  };
  leaveBalances: Record<string, number>; // Dynamic keys like ord_2025, ord_2026, com_log, etc.
  logoUrl?: string;
}
