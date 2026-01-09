import { UserSettings, WorkSession } from '../types';

// Fixed Italian Holidays (DD-MM)
// Corrected to DD-MM format to match getDay()/getMonth() logic
const FIXED_HOLIDAYS = new Set([
  '01-01', // Capodanno
  '06-01', // Epifania
  '25-04', // Liberazione
  '01-05', // Festa del Lavoro
  '02-06', // Repubblica
  '15-08', // Ferragosto
  '01-11', // Ognissanti
  '08-12', // Immacolata
  '25-12', // Natale
  '26-12', // Santo Stefano
]);

export const isHoliday = (date: Date): boolean => {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const dayMonth = `${d}-${m}`;
  return FIXED_HOLIDAYS.has(dayMonth);
};

export const getTargetHoursForDate = (dateString: string, settings: UserSettings): number => {
  let date: Date;
  
  // Handle different date string formats
  if (dateString.includes('T')) {
    // ISO String (has time): Parse as standard Date
    date = new Date(dateString);
  } else {
    // YYYY-MM-DD: Parse as local midnight to prevent UTC timezone shifts
    const [y, m, d] = dateString.split('-').map(Number);
    date = new Date(y, m - 1, d);
  }

  const day = date.getDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat

  // Check Holidays first
  if (isHoliday(date)) {
    return settings.schedule.satSun; // Treat holidays like weekends (usually 0)
  }

  // Sunday (0) or Saturday (6)
  if (day === 0 || day === 6) {
    return settings.schedule.satSun;
  }

  // Friday (5)
  if (day === 5) {
    return settings.schedule.fri;
  }

  // Mon (1) - Thu (4)
  return settings.schedule.monThu;
};

/**
 * Calculates the total cumulative balance (Monte Ore).
 * 
 * Logic:
 * 0. Start with Initial Rec. Comp. Balance from settings.
 * 1. 'work': Actual Duration - Target = Balance Change (Positive or Negative).
 * 2. 'ord', 'lic', 'rec_fest': Neutral (Balance Change = 0). It counts as a full day taken.
 * 3. 'com_log': Counts as 'Credited Hours' (like work) for the day, in hours.
 * 4. 'rec_comp': You are absent using overtime. Balance Change = -Target (e.g. -8.5h).
 * 5. 'operation': Specific work outside normal scope. Neutral (Balance Change = 0). Does not scale standard hours.
 */
export const calculateTotalBalance = (sessions: WorkSession[], settings: UserSettings): number => {
  const sessionsByDay = new Map<string, WorkSession[]>();

  // 1. Group sessions by unique day
  sessions.forEach(session => {
    // Use ISO date part YYYY-MM-DD based on local time
    const dateKey = new Date(session.startTime).toLocaleDateString('sv-SE'); 
    if (!sessionsByDay.has(dateKey)) {
      sessionsByDay.set(dateKey, []);
    }
    sessionsByDay.get(dateKey)!.push(session);
  });

  // Start with the initial balance set in settings
  let balance = settings.leaveBalances?.rec_comp || 0;

  // 2. Iterate each day
  sessionsByDay.forEach((daySessions, dateStr) => {
    const target = getTargetHoursForDate(dateStr, settings);
    
    // Check session types for this day
    const hasFullDayLeave = daySessions.some(s => ['ord_2025', 'ord_2026', 'lic_937', 'rec_fest'].includes(s.type));
    const hasRecComp = daySessions.some(s => s.type === 'rec_comp');
    const hasOperation = daySessions.some(s => s.type === 'operation');

    if (hasFullDayLeave || hasOperation) {
      // If taking formal full-day leave OR doing an Operation, it neutralizes the target. Balance change is 0.
      balance += 0; 
    } else if (hasRecComp) {
      // If taking Compensatory Recovery, we deduct the full target from the balance.
      balance -= target;
    } else {
      // Standard Work Day (or partial work / com_log)
      // Calculate total duration of credited sessions (Work + ComLog)
      let dailyCreditedDuration = 0;
      daySessions.forEach(s => {
        if ((s.type === 'work' || s.type === 'com_log') && s.endTime) {
          dailyCreditedDuration += (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / (1000 * 60 * 60);
        }
      });
      
      // Balance = Credited - Target
      balance += (dailyCreditedDuration - target);
    }
  });

  return balance;
};

/**
 * Calculates used quantities for leaves.
 * - Days for ord/lic/rec_fest
 * - Hours for com_log
 */
export const calculateUsedLeave = (sessions: WorkSession[]) => {
  const usage = {
    ord_2025: 0,
    ord_2026: 0,
    lic_937: 0,
    rec_fest: 0,
    com_log: 0
  };

  sessions.forEach(s => {
    if (s.type === 'work' || s.type === 'rec_comp' || s.type === 'operation') return;
    
    if (s.type === 'com_log') {
      if (s.endTime) {
        const hours = (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / (1000 * 60 * 60);
        usage.com_log += hours;
      }
    } else if (s.type in usage) {
      // Treat every other non-work session as 1 full unit (day)
      usage[s.type as keyof typeof usage] += 1;
    }
  });

  return usage;
};

/**
 * Calculates earned days based on work rules.
 * Rule: Working on a holiday earns 1 'rec_fest' day.
 */
export const calculateEarnedDays = (sessions: WorkSession[]) => {
  const uniqueWorkHolidays = new Set<string>();

  sessions.forEach(s => {
    if (s.type === 'work') {
      const d = new Date(s.startTime);
      if (isHoliday(d)) {
        // Track unique days (DD/MM/YYYY)
        const dateKey = d.toLocaleDateString('it-IT'); 
        uniqueWorkHolidays.add(dateKey);
      }
    }
  });

  return {
    rec_fest: uniqueWorkHolidays.size
  };
};