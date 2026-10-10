import React from 'react';
import {
  Users,
  CheckCircle2,
  FileCheck2,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { cn } from '../../lib/utils';

interface MetricSummaryCardsProps {
  presentMetrics: {
    totalPresent: number;
    completed: number;
    inProgress: number;
  };
  actionMetrics: {
    pendingReviews: number;
    pendingOvertime: number;
    invalidRecords: number;
  };
  teamMetrics: {
    totalEmployees: number;
    complianceRate?: string;
  };
  className?: string;
}

export const MetricSummaryCards: React.FC<MetricSummaryCardsProps> = ({
  presentMetrics,
  actionMetrics,
  teamMetrics,
  className,
}) => {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-4', className)}>
      {/* 1. Present Summary Card */}
      <Card className="rounded-2xl border-border/70 shadow-sm hover:shadow transition-all bg-card/90">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Present Summary
              </h3>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              Active Today
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 text-center">
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium text-muted-foreground">Logged Today</p>
              <p className="text-2xl font-extrabold text-foreground tracking-tight">
                {presentMetrics.totalPresent}
              </p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                Shift logged
              </p>
            </div>
            <div className="space-y-0.5 border-x border-border/50 px-1">
              <p className="text-[11px] font-medium text-muted-foreground">In Progress</p>
              <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
                {presentMetrics.inProgress}
              </p>
              <p className="text-[10px] text-muted-foreground">Open shifts</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium text-muted-foreground">Completed</p>
              <p className="text-2xl font-extrabold text-foreground tracking-tight">
                {presentMetrics.completed}
              </p>
              <p className="text-[10px] text-muted-foreground">Full shift</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Action Required Summary Card */}
      <Card className="rounded-2xl border-border/70 shadow-sm hover:shadow transition-all bg-card/90">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-indigo-500/10 text-primary flex items-center justify-center">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Action Required
              </h3>
            </div>
            {(actionMetrics.pendingReviews > 0 || actionMetrics.pendingOvertime > 0) && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                Pending Audits
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 text-center">
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium text-muted-foreground">Verifications</p>
              <p
                className={cn(
                  'text-2xl font-extrabold tracking-tight',
                  actionMetrics.pendingReviews > 0
                    ? 'text-primary'
                    : 'text-foreground'
                )}
              >
                {actionMetrics.pendingReviews}
              </p>
              <p className="text-[10px] text-muted-foreground">Needs review</p>
            </div>
            <div className="space-y-0.5 border-x border-border/50 px-1">
              <p className="text-[11px] font-medium text-muted-foreground">Overtime</p>
              <p
                className={cn(
                  'text-2xl font-extrabold tracking-tight',
                  actionMetrics.pendingOvertime > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-foreground'
                )}
              >
                {actionMetrics.pendingOvertime}
              </p>
              <p className="text-[10px] text-muted-foreground">Requests</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium text-muted-foreground">Invalid</p>
              <p
                className={cn(
                  'text-2xl font-extrabold tracking-tight',
                  actionMetrics.invalidRecords > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-foreground'
                )}
              >
                {actionMetrics.invalidRecords}
              </p>
              <p className="text-[10px] text-muted-foreground">Flagged</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Workforce & Compliance Summary Card */}
      <Card className="rounded-2xl border-border/70 shadow-sm hover:shadow transition-all bg-card/90">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Workforce Scope
              </h3>
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">
              Total Enrolled
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 text-center">
            <div className="space-y-0.5 border-r border-border/50 pr-2">
              <p className="text-[11px] font-medium text-muted-foreground">Total Members</p>
              <p className="text-2xl font-extrabold text-foreground tracking-tight">
                {teamMetrics.totalEmployees}
              </p>
              <p className="text-[10px] text-muted-foreground">Employees</p>
            </div>
            <div className="space-y-0.5 pl-2">
              <p className="text-[11px] font-medium text-muted-foreground">Compliance</p>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                {teamMetrics.complianceRate || '100%'}
              </p>
              <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-medium">
                Geofence & Valid
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
