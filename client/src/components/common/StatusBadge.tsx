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
  LeaveStatus,
} from '../../types/models';

type BadgeType = 'working' | 'verification' | 'overtime' | 'leave';

interface StatusBadgeProps {
  type?: BadgeType;
  kind?: BadgeType;
  size?: 'sm' | 'md' | 'lg';
  status?: WorkingStatus | VerificationStatus | OvertimeStatus | LeaveStatus | string | null;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  type,
  kind,
  size = 'md',
  status,
  className,
}) => {
  const activeType = type || kind || 'working';
  const sizeClass =
    size === 'sm'
      ? 'text-[11px] px-2 py-0.5'
      : size === 'lg'
        ? 'text-sm px-3 py-1'
        : 'text-xs px-2.5 py-0.5';

  if (!status) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-full font-medium bg-muted text-muted-foreground', sizeClass, className)}>
        <HelpCircle className="w-3.5 h-3.5" />
        <span>N/A</span>
      </span>
    );
  }

  // Working Status Mapping
  if (activeType === 'working') {
    switch (status) {
      case 'in_progress':
        return (
          <span
            data-testid="badge-working-in_progress"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70 shadow-xs',
              className
            )}
          >
            <Clock className="w-3.5 h-3.5 animate-pulse text-amber-600 dark:text-amber-400" />
            <span>In Progress</span>
          </span>
        );
      case 'completed':
        return (
          <span
            data-testid="badge-working-completed"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 shadow-xs',
              className
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Completed (8h+)</span>
          </span>
        );
      case 'incomplete':
        return (
          <span
            data-testid="badge-working-incomplete"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 border border-orange-200 dark:border-orange-800/70 shadow-xs',
              className
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
            <span>Incomplete (&lt;8h)</span>
          </span>
        );
      case 'missed':
        return (
          <span
            data-testid="badge-working-missed"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 shadow-xs',
              className
            )}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
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
  if (activeType === 'verification') {
    switch (status) {
      case 'valid':
        return (
          <span
            data-testid="badge-verification-valid"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 shadow-xs',
              className
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Valid</span>
          </span>
        );
      case 'invalid':
        return (
          <span
            data-testid="badge-verification-invalid"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 shadow-xs',
              className
            )}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>Invalid</span>
          </span>
        );
      case 'pending':
      default:
        return (
          <span
            data-testid="badge-verification-pending"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70 shadow-xs',
              className
            )}
          >
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Pending Review</span>
          </span>
        );
    }
  }

  // Overtime Status Mapping
  if (activeType === 'overtime') {
    switch (status) {
      case 'approved':
        return (
          <span
            data-testid="badge-overtime-approved"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 shadow-xs',
              className
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>OT Approved</span>
          </span>
        );
      case 'rejected':
        return (
          <span
            data-testid="badge-overtime-rejected"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 shadow-xs',
              className
            )}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>OT Rejected</span>
          </span>
        );
      case 'pending':
        return (
          <span
            data-testid="badge-overtime-pending"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70 shadow-xs',
              className
            )}
          >
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
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
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100/80 text-slate-600 dark:bg-slate-900/60 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800',
              className
            )}
          >
            <span>None</span>
          </span>
        );
    }
  }

  if (activeType === 'leave') {
    switch (status) {
      case 'approved':
        return (
          <span
            data-testid="badge-leave-approved"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800',
              sizeClass,
              className
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approved</span>
          </span>
        );
      case 'rejected':
        return (
          <span
            data-testid="badge-leave-rejected"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800',
              sizeClass,
              className
            )}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Rejected</span>
          </span>
        );
      case 'cancelled':
        return (
          <span
            data-testid="badge-leave-cancelled"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full font-semibold bg-slate-100 text-slate-700 dark:bg-slate-900/60 dark:text-slate-400 border border-slate-300 dark:border-slate-800',
              sizeClass,
              className
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Cancelled</span>
          </span>
        );
      case 'pending':
      default:
        return (
          <span
            data-testid="badge-leave-pending"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800',
              sizeClass,
              className
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending</span>
          </span>
        );
    }
  }

  return null;
};

export default StatusBadge;
