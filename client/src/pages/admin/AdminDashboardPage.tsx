import React from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeletons } from '../../components/common/Skeletons';
import { ErrorState } from '../../components/common/ErrorState';
import { useGetDashboardSummaryQuery } from '../../features/dashboard/dashboardApi';
import type { AdminDashboardMetrics } from '../../types/models';
import {
  Users,
  Clock,
  ShieldCheck,
  ArrowRight,
  Building2,
  FileSpreadsheet,
} from 'lucide-react';

import { MetricSummaryCards } from '../../components/common/MetricSummaryCards';

export const AdminDashboardPage: React.FC = () => {
  const { data, isLoading, isError, refetch } = useGetDashboardSummaryQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="System Administration Dashboard"
          description="Organization-wide workforce metrics, user counts, and compliance operations"
        />
        <Skeletons count={4} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="System Administration Dashboard"
          description="Organization-wide workforce metrics, user counts, and compliance operations"
        />
        <ErrorState
          title="Failed to load admin metrics"
          message="Could not retrieve system summary data. Please try again."
          onRetry={refetch}
        />
      </div>
    );
  }

  const metrics = data as AdminDashboardMetrics;
  const totalEmployees = metrics.totalUsers?.employee || 0;
  const totalManagers = metrics.totalUsers?.manager || 0;
  const totalAdmins = metrics.totalUsers?.admin || 0;
  const totalUsersCount = totalEmployees + totalManagers + totalAdmins;

  const inProgressCount = Math.max(
    0,
    (metrics.today?.punchedIn || 0) -
      (metrics.today?.completed || 0) -
      (metrics.today?.incomplete || 0)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <PageHeader
            title="System Administration Dashboard"
            description="High-level visibility into company-wide workforce operations, attendance, and compliance"
          />
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/reports">
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
          totalPresent: metrics.today?.punchedIn || 0,
          completed: metrics.today?.completed || 0,
          inProgress: inProgressCount,
        }}
        actionMetrics={{
          pendingReviews: metrics.today?.pendingVerification || 0,
          pendingOvertime: metrics.today?.pendingOvertime || 0,
          invalidRecords: metrics.today?.incomplete || 0,
        }}
        teamMetrics={{
          totalEmployees: totalUsersCount,
          complianceRate:
            totalUsersCount > 0
              ? `${Math.round(((metrics.activeUsers || 0) / totalUsersCount) * 100)}%`
              : '100%',
        }}
      />



      {/* Admin Modules Quick Launch */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <Link to="/admin/users" className="block">
          <Card className="h-full border-border/70 hover:border-primary/40 hover:shadow-md transition-all p-5 flex flex-col justify-between group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3 group-hover:bg-blue-500 group-hover:text-white transition-all">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-foreground mb-1 group-hover:text-primary transition-colors">
                User Management
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Add roles, assign managers to employees, and activate/deactivate accounts.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary group-hover:gap-2 transition-all">
              <span>Open User Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Card>
        </Link>

        <Link to="/admin/review" className="block">
          <Card className="h-full border-border/70 hover:border-primary/40 hover:shadow-md transition-all p-5 flex flex-col justify-between group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center mb-3 group-hover:bg-violet-500 group-hover:text-white transition-all">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-foreground mb-1 group-hover:text-primary transition-colors">
                Verification Audits
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Review employee selfies, GPS office distance, and audit shift records.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary group-hover:gap-2 transition-all">
              <span>View Verification Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Card>
        </Link>

        <Link to="/admin/settings" className="block">
          <Card className="h-full border-border/70 hover:border-primary/40 hover:shadow-md transition-all p-5 flex flex-col justify-between group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-slate-500/10 text-slate-500 flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-white transition-all">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-foreground mb-1 group-hover:text-primary transition-colors">
                Geofence Settings
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Configure office coordinates, enforcement radius, and GPS accuracy threshold.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary group-hover:gap-2 transition-all">
              <span>Configure Geofence</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
};
