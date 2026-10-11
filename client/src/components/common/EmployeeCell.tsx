import React from 'react';
import { cn } from '../../lib/utils';
import type { User } from '../../types/models';

interface EmployeeCellProps {
  employee?: User | { id?: string; _id?: string; name?: string; email?: string; role?: string } | null;
  subtitle?: string;
  avatarUrl?: string | null;
  className?: string;
}

export const EmployeeCell: React.FC<EmployeeCellProps> = ({
  employee,
  subtitle,
  avatarUrl,
  className,
}) => {
  if (!employee) {
    return <span className="text-muted-foreground text-xs italic">Unassigned</span>;
  }

  const name = employee.name || 'Unnamed';
  const displaySubtitle = subtitle || employee.email || employee.role || '';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs ring-2 ring-primary/20 shrink-0 select-none overflow-hidden">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      <div className="flex flex-col text-left leading-tight min-w-0">
        <span
          className="font-bold text-xs text-foreground truncate max-w-[160px]"
          title={name}
        >
          {name}
        </span>
        {displaySubtitle && (
          <span
            className="text-[11px] text-muted-foreground truncate max-w-[160px]"
            title={displaySubtitle}
          >
            {displaySubtitle}
          </span>
        )}
      </div>
    </div>
  );
};
