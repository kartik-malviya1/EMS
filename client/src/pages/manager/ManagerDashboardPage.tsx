import React from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeletons } from '../../components/common/Skeletons';
import { ErrorState } from '../../components/common/ErrorState';
import { useGetDashboardSummaryQuery } from '../../features/dashboard/dashboardApi';
import type { ManagerDashboardMetrics } from '../../types/models';
import {
  Clock,
  ShieldCheck,
  ArrowRight,
  Calendar,
  FileSpreadsheet,
} from 'lucide-react';

import { MetricSummaryCards } from '../../components/common/MetricSummaryCards';

export const ManagerDashboardPage: React.FC = () => {
  const { data, isLoading, isError, refetch } = useGetDashboardSummaryQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Team Overview & Attendance"
          description="Realtime monitoring of your team's shifts, attendance, and approvals"
        />
        <Skeletons count={4} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Team Overview & Attendance"
          description="Realtime monitoring of your team's shifts, attendance, and approvals"
        />
        <ErrorState
          title="Failed to load dashboard metrics"
          message="Could not retrieve team summary data. Please try again."
          onRetry={refetch}
        />
      </div>
    );
  }

  const metrics = data as ManagerDashboardMetrics;
  const inProgressCount = Math.max(
    0,
    metrics.punchedIn - (metrics.completed || 0) - (metrics.incomplete || 0)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <PageHeader
            title="Team Overview & Attendance"
            description="Real-time shift tracking, attendance auditing, and overtime management for your team"
          />
        </div>
        <div className="flex items-center gap-2">
          <Link to="/manager/reports">
            <Button variant="outline" size="sm" className="gap-1.5 h-9 rounded-xl text-xs font-semibold">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Reports
            </Button>
          </Link>
          <Link to="/employee">
            <Button size="sm" className="gap-1.5 h-9 rounded-xl text-xs font-semibold shadow-xs">
              <Clock className="w-3.5 h-3.5" /> My Personal Shift
            </Button>
          </Link>
        </div>
      </div>

      {/* Tiimi-Inspired 3-Column Summary Cards */}
      <MetricSummaryCards
        presentMetrics={{
          totalPresent: metrics.punchedIn,
          completed: metrics.completed || 0,
          inProgress: inProgressCount,
        }}
        actionMetrics={{
          pendingReviews: metrics.pendingVerification || 0,
          pendingOvertime: metrics.pendingOvertime || 0,
          invalidRecords: metrics.incomplete || 0,
        }}
        teamMetrics={{
          totalEmployees: metrics.teamSize || 0,
          complianceRate:
            metrics.teamSize > 0
              ? `${Math.round(((metrics.completed || 0) / Math.max(1, metrics.punchedIn || 1)) * 100)}%`
              : '100%',
        }}
      />

      {/* Quick Action Hub */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <Link to="/manager/review" className="block">
          <Card className="h-full border-border/70 hover:border-primary/40 hover:shadow-md transition-all p-5 flex flex-col justify-between group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center mb-3 group-hover:bg-violet-500 group-hover:text-white transition-all">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-foreground mb-1 group-hover:text-primary transition-colors">
                Verification Queue
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Review selfies and geofence verification for completed shifts.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary group-hover:gap-2 transition-all">
              <span>Audit pending items</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Card>
        </Link>

        <Link to="/manager/overtime" className="block">
          <Card className="h-full border-border/70 hover:border-primary/40 hover:shadow-md transition-all p-5 flex flex-col justify-between group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-3 group-hover:bg-orange-500 group-hover:text-white transition-all">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-foreground mb-1 group-hover:text-primary transition-colors">
                Overtime Requests
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Approve or reject overtime requests submitted by your team.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary group-hover:gap-2 transition-all">
              <span>Process requests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Card>
        </Link>

        <Link to="/manager/attendance" className="block">
          <Card className="h-full border-border/70 hover:border-primary/40 hover:shadow-md transition-all p-5 flex flex-col justify-between group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3 group-hover:bg-blue-500 group-hover:text-white transition-all">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-foreground mb-1 group-hover:text-primary transition-colors">
                Team Shift History
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Search, filter, and review historical shifts across all team members.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary group-hover:gap-2 transition-all">
              <span>View full history</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
};
