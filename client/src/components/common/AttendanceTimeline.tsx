import React from 'react';
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
    if (!iso) return '--:--';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const formatHours = (mins?: number | null) => {
    if (mins == null || mins === 0) {
      if (workingStatus === 'in_progress') return 'In Progress';
      return '--';
    }
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  const inTime = formatTime(punchInAt);
  const outTime = formatTime(punchOutAt);
  const durationText = formatHours(workedMinutes);
  const isInProgress = workingStatus === 'in_progress';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 text-xs font-medium py-1 px-2 rounded-xl bg-muted/40 border border-border/50',
        className
      )}
    >
      {/* Clock In */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 shrink-0" />
        <span className="font-semibold text-foreground tracking-tight">{inTime}</span>
      </div>

      {/* Timeline connector */}
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground px-1 select-none">
        <span className="h-[1.5px] w-3 bg-border" />
        <span
          className={cn(
            'px-1.5 py-0.5 rounded-md font-semibold text-[10px] tracking-tight',
            isInProgress
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse'
              : 'bg-background border border-border/70 text-muted-foreground'
          )}
        >
          {durationText}
        </span>
        <span className="h-[1.5px] w-3 bg-border" />
      </div>

      {/* Clock Out */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={cn(
            'h-2 w-2 rounded-full ring-2 shrink-0',
            punchOutAt
              ? 'bg-amber-500 ring-amber-500/20'
              : 'bg-muted-foreground/40 ring-transparent'
          )}
        />
        <span
          className={cn(
            'font-semibold tracking-tight',
            punchOutAt ? 'text-foreground' : 'text-muted-foreground/60'
          )}
        >
          {outTime}
        </span>
      </div>
    </div>
  );
};
