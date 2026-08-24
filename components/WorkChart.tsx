import React, { useMemo } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { WorkSession, UserSettings, SessionType } from '../types';
import { getTargetHoursForDate } from '../services/dateService';

interface WorkChartProps {
  sessions: WorkSession[];
  settings: UserSettings;
}

// Color palette with high contrast and distinct colors for every category
const BASE_COLORS: Record<string, string> = {
  work: '#475569',      // Slate-600 (Lavoro standard - solido e distinto)
  servizio: '#8b5cf6',  // Violet-500 (Servizio - viola vivace ben differenziato)
  lic_937: '#d946ef',   // Fuchsia-500 (Lic 937 - fucsia/magenta acceso)
  rec_fest: '#ea580c',  // Orange-600 (Rec Fest - arancione brillante)
  rec_comp: '#10b981',  // Emerald-500 (Rec Comp - verde smeraldo)
  com_log: '#f43f5e',   // Rose-500 (Com. Log. - rosso rosa intenso)
  operation: '#eab308', // Amber-500 (Operazione - giallo ambra)
};

const BASE_LABELS: Record<string, string> = {
  work: 'Lavoro',
  servizio: 'Servizio',
  com_log: 'Com. Log.',
  operation: 'Operazione',
  lic_937: 'Lic. 937',
  rec_fest: 'Rec. Fest.',
  rec_comp: 'Rec. Comp.',
};

// Distinct colors for each year of ordinary leave (Ord. 24, Ord. 25, Ord. 26, etc.)
const YEAR_ORD_COLORS: Record<string, string> = {
  'ord_2023': '#0f766e', // Teal-700
  'ord_2024': '#0891b2', // Cyan-700
  'ord_2025': '#06b6d4', // Bright Cyan-500 (Turchese / Cyan vivo per Ord. 25)
  'ord_2026': '#2563eb', // Royal Blue-600 (Blu reale intenso per Ord. 26)
  'ord_2027': '#38bdf8', // Sky Blue-400 (Azzurro cielo)
  'ord_2028': '#60a5fa', // Blue-400
  'ord_2029': '#818cf8', // Indigo-400
  'ord_2030': '#a78bfa', // Purple-400
};

const FALLBACK_ORD_COLORS = [
  '#06b6d4', // Cyan
  '#2563eb', // Royal Blue
  '#0284c7', // Sky Blue
  '#14b8a6', // Teal
  '#4f46e5', // Indigo
  '#38bdf8', // Light Sky
];

const WorkChart: React.FC<WorkChartProps> = ({ sessions, settings }) => {
  // Generate dynamic colors and labels for ordinary leave based on settings
  const dynamicConfig = useMemo(() => {
    const colors = { ...BASE_COLORS };
    const labels = { ...BASE_LABELS };
    
    // Assign distinct, clear colors to dynamically found 'ord_YYYY' keys
    const ordKeys = Object.keys(settings.leaveBalances).filter(k => k.startsWith('ord_')).sort();
    
    ordKeys.forEach((key, index) => {
      const year = key.split('_')[1];
      colors[key] = YEAR_ORD_COLORS[key] || FALLBACK_ORD_COLORS[index % FALLBACK_ORD_COLORS.length];
      labels[key] = `Ord. ${year.slice(-2)}`;
    });
    
    return { colors, labels };
  }, [settings.leaveBalances]);

  const { colors: TYPE_COLORS, labels: TYPE_LABELS } = dynamicConfig;

  const data = useMemo(() => {
    // 1. Initialize map for last 7 days
    const dayMap = new Map<string, any>();
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateKey = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
      
      // Initialize structure with 0 for all types dynamically
      const dayData: any = {
        date: dateKey,
        dateFull: d.toISOString(),
        total: 0,
        work: 0,
        servizio: 0,
        com_log: 0,
        operation: 0,
        lic_937: 0,
        rec_fest: 0,
        rec_comp: 0
      };
      
      // Inject ord keys dynamically
      Object.keys(TYPE_COLORS).forEach(k => {
        if (!dayData[k]) dayData[k] = 0;
      });
      
      dayMap.set(dateKey, dayData);
    }

    // 2. Aggregate hours by type
    const sortedSessions = [...sessions].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    sortedSessions.forEach(session => {
      if (!session.endTime) return;
      const dateKey = new Date(session.startTime).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
      
      // Only process if within our window logic (or extends it if desired, but sticking to last 7 days visual)
      if (dayMap.has(dateKey)) {
        const current = dayMap.get(dateKey);
        const durationHours = (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60 * 60);
        
        // Add to specific type bucket
        if (current[session.type] !== undefined) {
          current[session.type] += durationHours;
          current.total += durationHours;
        }
      }
    });

    // 3. Format for Recharts and add Target
    return Array.from(dayMap.values()).map(day => {
      const target = getTargetHoursForDate(day.dateFull, settings);
      
      // Round all values to 2 decimals for clean tooltips
      const roundedDay = { ...day, target };
      Object.keys(TYPE_COLORS).forEach(key => {
        roundedDay[key] = parseFloat(roundedDay[key].toFixed(2));
      });
      roundedDay.total = parseFloat(roundedDay.total.toFixed(2));
      
      return roundedDay;
    });
  }, [sessions, settings]);

  if (data.length === 0) {
    return <div className="text-center text-slate-400 py-10">Nessun dato disponibile.</div>;
  }

  // Identify which keys actually have data to avoid cluttering the legend/stack
  const activeKeys = Object.keys(TYPE_COLORS).filter(key => 
    data.some(d => d[key] > 0)
  );

  return (
    <div className="h-64 md:h-80 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 0, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
          
          <Tooltip 
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
            formatter={(value: number, name: string) => {
              if (value === 0) return [undefined, undefined]; // Hide 0 values
              return [`${value}h`, TYPE_LABELS[name] || name];
            }}
            labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
          />
          
          <Legend 
            iconSize={8} 
            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
          />
          
          {/* Stacked Bars for each Type */}
          {activeKeys.map(key => (
            <Bar 
              key={key}
              dataKey={key}
              name={TYPE_LABELS[key]}
              stackId="a"
              fill={TYPE_COLORS[key]}
              barSize={20}
              radius={[2, 2, 2, 2]} // Slight radius on segments
            />
          ))}

          {/* Target Line */}
          <Line 
            type="stepAfter" 
            dataKey="target" 
            name="Obiettivo" 
            stroke="#ef4444" 
            strokeWidth={2} 
            dot={false}
            strokeDasharray="4 4"
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WorkChart;