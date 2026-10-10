import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface DateNavigatorProps {
  currentDate: string; // YYYY-MM-DD
  onDateChange: (newDate: string) => void;
  className?: string;
}

export const DateNavigator: React.FC<DateNavigatorProps> = ({
  currentDate,
  onDateChange,
  className,
}) => {
  const parseDate = (dStr: string) => {
    try {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
      return new Date(dStr);
    } catch {
      return new Date();
    }
  };

  const toYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const handlePrev = () => {
    const d = parseDate(currentDate);
    d.setDate(d.getDate() - 1);
    onDateChange(toYMD(d));
  };

  const handleNext = () => {
    const d = parseDate(currentDate);
    d.setDate(d.getDate() + 1);
    onDateChange(toYMD(d));
  };

  const handleToday = () => {
    onDateChange(toYMD(new Date()));
  };

  const todayStr = toYMD(new Date());
  const isToday = currentDate === todayStr;

  const dateObj = parseDate(currentDate);
  const formattedString = dateObj.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className={cn('inline-flex items-center gap-1.5 p-1 rounded-xl bg-card border border-border/80 shadow-xs', className)}>
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrev}
        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
        title="Previous Day"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      <div className="flex items-center gap-1.5 px-2 text-xs font-bold text-foreground select-none">
        <CalendarIcon className="w-3.5 h-3.5 text-primary" />
        <span>{formattedString}</span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleNext}
        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
        title="Next Day"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>

      {!isToday && (
        <button
          type="button"
          onClick={handleToday}
          className="ml-1 text-[11px] font-bold text-primary hover:underline px-2 py-1 rounded-md bg-primary/10 transition-colors"
        >
          Today
        </button>
      )}
    </div>
  );
};
