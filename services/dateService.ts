
import { UserSettings, WorkSession } from '../types';

const FIXED_HOLIDAYS = new Set([
  '01-01', '06-01', '25-04', '01-05', '02-06', '15-08', '01-11', '08-12', '25-12', '26-12',
]);

export const isHoliday = (date: Date): boolean => {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const dayMonth = `${d}-${m}`;
  return FIXED_HOLIDAYS.has(dayMonth);
};

export const getTargetHoursForDate = (dateString: string, settings: UserSettings): number => {
  let date: Date;
  if (dateString.includes('T')) {
    date = new Date(dateString);
  } else {
    const [y, m, d] = dateString.split('-').map(Number);
    date = new Date(y, m - 1, d);
  }
  const day = date.getDay();
  if (isHoliday(date) || day === 0 || day === 6) return settings.schedule.satSun;
  if (day === 5) return settings.schedule.fri;
  return settings.schedule.monThu;
};

export const calculateTotalBalance = (sessions: WorkSession[], settings: UserSettings): number => {
  const sessionsByDay = new Map<string, WorkSession[]>();
  sessions.forEach(session => {
    const dateKey = new Date(session.startTime).toLocaleDateString('sv-SE'); 
    if (!sessionsByDay.has(dateKey)) sessionsByDay.set(dateKey, []);
    sessionsByDay.get(dateKey)!.push(session);
  });

  let balance = settings.leaveBalances?.rec_comp || 0;

  sessionsByDay.forEach((daySessions, dateStr) => {
    const target = getTargetHoursForDate(dateStr, settings);
    const hasFullDayLeave = daySessions.some(s => s.type.startsWith('ord_') || ['lic_937', 'rec_fest'].includes(s.type));
    const hasRecComp = daySessions.some(s => s.type === 'rec_comp');
    const hasOperation = daySessions.some(s => s.type === 'operation');

    if (hasFullDayLeave || hasOperation) {
      balance += 0; 
    } else if (hasRecComp) {
      balance -= target;
    } else {
      let workHours = 0;
      let comLogHours = 0;
      daySessions.forEach(s => {
        if (s.endTime) {
          const hours = (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / (1000 * 60 * 60);
          if (s.type === 'work' || s.type === 'servizio') {
            workHours += hours;
          } else if (s.type === 'com_log') {
            comLogHours += hours;
          }
        }
      });
      
      const totalHours = workHours + comLogHours;
      if (totalHours > 0 || daySessions.some(s => s.type === 'work' || s.type === 'servizio' || s.type === 'com_log')) {
         const extra = totalHours - target;
         if (extra > 0) {
            const earnedComLog = Math.min(extra, comLogHours);
            const earnedOrdinary = extra - earnedComLog;
            balance += earnedOrdinary;
         } else {
            balance += extra; // negative
         }
      }
    }
  });

  return balance;
};

export const calculateUsedLeave = (sessions: WorkSession[]) => {
  const usage: Record<string, number> = {};

  sessions.forEach(s => {
    if (['work', 'servizio', 'rec_comp', 'operation', 'com_log'].includes(s.type)) return;
    
    usage[s.type] = (usage[s.type] || 0) + 1;
  });

  return usage;
};

export const calculateEarnedDays = (sessions: WorkSession[], settings: UserSettings) => {
  const uniqueWorkHolidays = new Set<string>();
  
  const sessionsByDay = new Map<string, WorkSession[]>();
  
  sessions.forEach(s => {
    const date = new Date(s.startTime);
    const day = date.getDay();
    if ((s.type === 'work' || s.type === 'servizio') && (isHoliday(date) || day === 0 || day === 6)) {
      uniqueWorkHolidays.add(date.toLocaleDateString('it-IT'));
    }
    
    const dateKey = date.toLocaleDateString('sv-SE'); 
    if (!sessionsByDay.has(dateKey)) sessionsByDay.set(dateKey, []);
    sessionsByDay.get(dateKey)!.push(s);
  });

  let earnedComLog = 0;
  sessionsByDay.forEach((daySessions, dateStr) => {
    const target = getTargetHoursForDate(dateStr, settings);
    const hasFullDayLeave = daySessions.some(s => s.type.startsWith('ord_') || ['lic_937', 'rec_fest', 'operation', 'rec_comp'].includes(s.type));
    
    if (hasFullDayLeave) return;

    let workHours = 0;
    let comLogHours = 0;
    daySessions.forEach(s => {
      if (s.endTime) {
        const hours = (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / (1000 * 60 * 60);
        if (s.type === 'work' || s.type === 'servizio') {
          workHours += hours;
        } else if (s.type === 'com_log') {
          comLogHours += hours;
        }
      }
    });
    
    const totalHours = workHours + comLogHours;
    if (totalHours > target && comLogHours > 0) {
       earnedComLog += Math.min(totalHours - target, comLogHours);
    }
  });

  return { rec_fest: uniqueWorkHolidays.size, com_log: earnedComLog };
};
