import React from 'react';
import { cn } from '../../lib/utils';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  highlightCount?: boolean;
}

interface TabNavigationProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  onChange,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex items-center gap-6 border-b border-border/70 overflow-x-auto scrollbar-none',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'group relative pb-3 flex items-center gap-2 text-sm font-semibold transition-all duration-200 shrink-0 cursor-pointer',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span>{tab.label}</span>

            {tab.count !== undefined && tab.count !== null && (
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[11px] font-bold transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground group-hover:bg-muted/80',
                  tab.highlightCount && tab.count > 0 && 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                )}
              >
                {tab.count}
              </span>
            )}

            {/* Active Underline Bar */}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full shadow-xs" />
            )}
          </button>
        );
      })}
    </div>
  );
};
