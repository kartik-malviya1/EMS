import React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AttendanceTimelineProps {
  punchInAt?: string | null;
  punchOutAt?: string | null;
  workedMinutes?: number | null;
  workingStatus?: string;
  className?: string;
}

export const AttendanceTimeline: React.FC<AttendanceTimelineProps> = ({
  punchInAt,
  punchOutAt,
  workedMinutes,
  workingStatus,
  className,
}) => {
  const formatTime = (iso?: string | null) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  };

  const formatDuration = (mins?: number | null) => {
    if (mins != null && mins > 0) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h ${m.toString().padStart(2, '0')}m`;
    }
    if (workingStatus === 'in_progress') {
      return 'Active shift';
    }
    return null;
  };

  const inTime = formatTime(punchInAt);
  const outTime = formatTime(punchOutAt);
  const duration = formatDuration(workedMinutes);

  if (!inTime && !outTime) {
    return <span className="text-muted-foreground/50 text-xs select-none">—</span>;
  }

  return (
    <div className={cn('flex flex-col justify-center leading-tight py-0.5', className)}>
      <div className="flex items-center gap-1.5 text-xs font-medium tabular-nums text-foreground">
        <span className={inTime ? 'font-semibold text-foreground' : 'text-muted-foreground/50'}>
          {inTime || '—'}
        </span>
        <span className="text-muted-foreground/40 text-[11px] font-normal select-none">
          →
        </span>
        <span className={outTime ? 'font-semibold text-foreground' : 'text-muted-foreground/50'}>
          {outTime || '—'}
        </span>
      </div>

      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
        <Clock className="w-3 h-3 text-muted-foreground/70 shrink-0" />
        <span className={workingStatus === 'in_progress' ? 'text-amber-700 dark:text-amber-400 font-medium' : ''}>
          {duration || (workingStatus === 'in_progress' ? 'Active shift' : '0h 00m')}
        </span>
      </div>
    </div>
  );
};

