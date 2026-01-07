import React, { useMemo } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { WorkSession, UserSettings } from '../types';
import { getTargetHoursForDate } from '../services/dateService';

interface WorkChartProps {
  sessions: WorkSession[];
  settings: UserSettings;
}

const WorkChart: React.FC<WorkChartProps> = ({ sessions, settings }) => {
  const data = useMemo(() => {
    // Aggregate by day
    const dayMap = new Map<string, { hours: number; dateFull: string }>();
    
    // Initialize last 7 days to ensure gaps are shown correctly (e.g. 0 hours worked)
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateKey = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
      dayMap.set(dateKey, { hours: 0, dateFull: d.toISOString() });
    }

    // Sort sessions
    const sortedSessions = [...sessions].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    sortedSessions.forEach(session => {
      if (!session.endTime) return;
      const dateKey = new Date(session.startTime).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
      
      // Only process if within our 7-day window (or simply update existing keys)
      if (dayMap.has(dateKey)) {
        const current = dayMap.get(dateKey)!;
        const durationHours = (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60 * 60);
        current.hours += durationHours;
      }
    });

    // Convert to array
    return Array.from(dayMap.entries()).map(([date, info]) => {
      const target = getTargetHoursForDate(info.dateFull, settings);
      return {
        date,
        hours: parseFloat(info.hours.toFixed(2)),
        target: target,
        overtime: parseFloat((info.hours - target).toFixed(2))
      };
    });
  }, [sessions, settings]);

  if (data.length === 0) {
    return <div className="text-center text-slate-400 py-10">Nessun dato disponibile per il grafico.</div>;
  }

  return (
    <div className="h-56 md:h-72 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 0, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
          <Tooltip 
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
            formatter={(value: number, name: string) => [
              `${value}h`, 
              name === 'hours' ? 'Lavorato' : 'Obiettivo'
            ]}
          />
          <Legend iconSize={8} wrapperStyle={{fontSize: '11px', paddingTop: '10px'}}/>
          
          <Bar dataKey="hours" name="Lavorato" barSize={16} radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.hours >= entry.target ? '#22c55e' : (entry.hours > 0 ? '#3b82f6' : '#e2e8f0')} />
            ))}
          </Bar>
          
          {/* Target Line - Stepped to show clear differences between Fri/Mon */}
          <Line 
            type="stepAfter" 
            dataKey="target" 
            name="Obiettivo" 
            stroke="#ef4444" 
            strokeWidth={2} 
            dot={{ r: 2, fill: '#ef4444', strokeWidth: 0 }} 
            strokeDasharray="4 4"
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WorkChart;