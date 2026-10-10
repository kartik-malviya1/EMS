import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setTheme } from '../../features/theme/themeSlice';
import { cn } from '../../lib/utils';

export const ThemeSegmentedSwitch: React.FC<{ className?: string }> = ({
  className,
}) => {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.theme.theme);

  return (
    <div
      className={cn(
        'inline-flex items-center p-1 rounded-xl bg-muted/70 border border-border/80 w-full select-none',
        className
      )}
    >
      <button
        type="button"
        onClick={() => dispatch(setTheme('light'))}
        className={cn(
          'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer',
          theme === 'light'
            ? 'bg-background text-foreground shadow-xs font-bold'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Sun className="w-3.5 h-3.5" />
        <span>Light</span>
      </button>

      <button
        type="button"
        onClick={() => dispatch(setTheme('dark'))}
        className={cn(
          'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer',
          theme === 'dark'
            ? 'bg-background text-foreground shadow-xs font-bold'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Moon className="w-3.5 h-3.5" />
        <span>Dark</span>
      </button>
    </div>
  );
};
