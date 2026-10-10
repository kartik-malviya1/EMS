import React from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  WorkingStatus,
  VerificationStatus,
  OvertimeStatus,
} from '../../types/models';

type BadgeType = 'working' | 'verification' | 'overtime';

interface StatusBadgeProps {
  type: BadgeType;
  status?: WorkingStatus | VerificationStatus | OvertimeStatus | string | null;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  type,
  status,
  className,
}) => {
  if (!status) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground', className)}>
        <HelpCircle className="w-3.5 h-3.5" />
        <span>N/A</span>
      </span>
    );
  }

  // Working Status Mapping
  if (type === 'working') {
    switch (status) {
      case 'in_progress':
        return (
          <span
            data-testid="badge-working-in_progress"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800',
              className
            )}
          >
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            <span>In Progress</span>
          </span>
        );
      case 'completed':
        return (
          <span
            data-testid="badge-working-completed"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800',
              className
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed (8h+)</span>
          </span>
        );
      case 'incomplete':
        return (
          <span
            data-testid="badge-working-incomplete"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-300 dark:border-orange-800',
              className
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Incomplete (&lt;8h)</span>
          </span>
        );
      case 'missed':
        return (
          <span
            data-testid="badge-working-missed"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800',
              className
            )}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Missed Shift</span>
          </span>
        );
      default:
        return (
          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground', className)}>
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{String(status)}</span>
          </span>
        );
    }
  }

  // Verification Status Mapping
  if (type === 'verification') {
    switch (status) {
      case 'valid':
        return (
          <span
            data-testid="badge-verification-valid"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800',
              className
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Valid</span>
          </span>
        );
      case 'invalid':
        return (
          <span
            data-testid="badge-verification-invalid"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800',
              className
            )}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Invalid</span>
          </span>
        );
      case 'pending':
      default:
        return (
          <span
            data-testid="badge-verification-pending"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800',
              className
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Review</span>
          </span>
        );
    }
  }

  // Overtime Status Mapping
  if (type === 'overtime') {
    switch (status) {
      case 'approved':
        return (
          <span
            data-testid="badge-overtime-approved"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800',
              className
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>OT Approved</span>
          </span>
        );
      case 'rejected':
        return (
          <span
            data-testid="badge-overtime-rejected"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800',
              className
            )}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>OT Rejected</span>
          </span>
        );
      case 'pending':
        return (
          <span
            data-testid="badge-overtime-pending"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800',
              className
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>OT Pending</span>
          </span>
        );
      case 'not_requested':
      case 'none':
      default:
        return (
          <span
            data-testid="badge-overtime-none"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground',
              className
            )}
          >
            <span>None</span>
          </span>
        );
    }
  }

  return null;
};

export default StatusBadge;
