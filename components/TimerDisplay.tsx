import React, { useState, useEffect } from 'react';

interface TimerDisplayProps {
  startTime: string;
}

const TimerDisplay: React.FC<TimerDisplayProps> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startTime).getTime();
    const interval = setInterval(() => {
      setElapsed(Date.now() - start);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="font-mono text-5xl md:text-6xl font-bold text-slate-800 tracking-tighter tabular-nums">
      {formatTime(elapsed)}
    </div>
  );
};

export default TimerDisplay;
