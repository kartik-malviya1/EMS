import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { MetricCardSkeleton } from '../common/Skeletons';
import type { EmployeeDashboardMetrics } from '../../types/models';

interface EmployeeSummaryCardsProps {
  metrics?: EmployeeDashboardMetrics | null;
  isLoading?: boolean;
}

export const EmployeeSummaryCards: React.FC<EmployeeSummaryCardsProps> = ({
  metrics,
  isLoading = false,
}) => {
  if (isLoading || !metrics) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
    );
  }

  const totalHours = Math.floor(metrics.totalWorkedMinutes / 60);
  const totalMinsRemainder = metrics.totalWorkedMinutes % 60;

  const otHours = Math.floor(metrics.approvedOvertimeMinutes / 60);
  const otMinsRemainder = metrics.approvedOvertimeMinutes % 60;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          30-Day Activity Overview
        </h3>
        <span className="text-xs text-muted-foreground">Rolling business window</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Completed Days */}
        <Card className="border-border/60 hover:border-emerald-500/40 transition-colors shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Completed Shifts
              </p>
              <p className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                {metrics.completedDays}
              </p>
              <p className="text-[11px] text-muted-foreground">≥ 8 hours standard shifts</p>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Time Worked */}
        <Card className="border-border/60 hover:border-primary/40 transition-colors shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Total Hours Worked
              </p>
              <p className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {totalHours}h {totalMinsRemainder}m
              </p>
              <p className="text-[11px] text-muted-foreground">
                {metrics.totalWorkedMinutes} total minutes logged
              </p>
            </div>
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Overtime Summary */}
        <Card className="border-border/60 hover:border-blue-500/40 transition-colors shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Overtime Approved
              </p>
              <p className="text-2xl font-bold font-mono tracking-tight text-blue-600 dark:text-blue-400">
                {otHours}h {otMinsRemainder}m
              </p>
              <p className="text-[11px] text-muted-foreground">
                {metrics.pendingOvertime > 0
                  ? `${metrics.pendingOvertime} pending approval`
                  : 'All requests reviewed'}
              </p>
            </div>
            <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Incomplete / Exceptions */}
        <Card
          className={`border-border/60 shadow-sm transition-colors ${
            metrics.invalidDays > 0 || metrics.missedDays > 0
              ? 'hover:border-rose-500/40'
              : 'hover:border-amber-500/40'
          }`}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Exceptions / Incomplete
              </p>
              <p className="text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400">
                {metrics.incompleteDays + metrics.missedDays}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {metrics.incompleteDays} incomplete · {metrics.missedDays} missed
              </p>
            </div>
            <div
              className={`p-3 rounded-xl ${
                metrics.invalidDays > 0
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}
            >
              {metrics.invalidDays > 0 ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmployeeSummaryCards;
