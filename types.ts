
export type SessionType = 'work' | 'servizio' | 'lic_937' | 'rec_fest' | 'rec_comp' | 'com_log' | 'operation' | string;

export interface WorkSession {
  id: string;
  startTime: string; // ISO string
  endTime: string | null; // ISO string
  type: SessionType;
  activityRaw: string;
  activityRefined: string;
  tags: string[];
}

export type TransactionType = 'income' | 'expense';

export type TransactionCategory = 
  | 'stipendio' 
  | 'extra_lavoro' 
  | 'altre_entrate'
  | 'casa_bollette' 
  | 'spesa_cibo' 
  | 'trasporti_auto' 
  | 'svago_tempo_libero' 
  | 'salute_benessere' 
  | 'shopping' 
  | 'risparmi_investimenti' 
  | 'abbonamenti' 
  | 'altro';

export interface MoneyTransaction {
  id: string;
  date: string; // ISO string (YYYY-MM-DD)
  amount: number;
  type: TransactionType;
  category: TransactionCategory | string;
  title: string;
  note?: string;
  isRecurring?: boolean;
}

export interface CategoryBudget {
  category: string;
  limit: number;
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
  categoryBudgets?: Record<string, number>;
  logoUrl?: string;
}
