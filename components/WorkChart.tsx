import React, { useMemo } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { WorkSession, UserSettings, SessionType } from '../types';
import { getTargetHoursForDate } from '../services/dateService';

interface WorkChartProps {
  sessions: WorkSession[];
  settings: UserSettings;
}

// Color palette matching App.tsx styling
const TYPE_COLORS: Record<string, string> = {
  work: '#334155',      // Slate-700 (Lavoro standard)
  com_log: '#db2777',   // Pink-600 (Com. Log.)
  operation: '#059669', // Emerald-600 (Operazione)
  ord_2025: '#2563eb',  // Blue-600 (Ord 2025)
  ord_2026: '#4f46e5',  // Indigo-600 (Ord 2026)
  lic_937: '#7e22ce',   // Purple-700 (Lic 937)
  rec_fest: '#c2410c',  // Orange-700 (Rec Fest)
  rec_comp: '#0d9488',  // Teal-600 (Rec Comp)
};

const TYPE_LABELS: Record<string, string> = {
  work: 'Lavoro',
  com_log: 'Com. Log.',
  operation: 'Operazione',
  ord_2025: 'Ord. 25',
  ord_2026: 'Ord. 26',
  lic_937: 'Lic. 937',
  rec_fest: 'Rec. Fest.',
  rec_comp: 'Rec. Comp.',
};

const WorkChart: React.FC<WorkChartProps> = ({ sessions, settings }) => {
  const data = useMemo(() => {
    // 1. Initialize map for last 7 days
    const dayMap = new Map<string, any>();
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateKey = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
      
      // Initialize structure with 0 for all types
      dayMap.set(dateKey, {
        date: dateKey,
        dateFull: d.toISOString(),
        total: 0,
        work: 0,
        com_log: 0,
        operation: 0,
        ord_2025: 0,
        ord_2026: 0,
        lic_937: 0,
        rec_fest: 0,
        rec_comp: 0
      });
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