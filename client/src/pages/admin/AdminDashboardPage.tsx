import React, { useState, useTransition } from 'react';
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
  ShieldCheck,
  ArrowRight,
  Building2,
  FileSpreadsheet,
  LayoutDashboard,
  Grid3X3,
  Clock,
  Calendar,
  FileText,
} from 'lucide-react';

import { MetricSummaryCards } from '../../components/common/MetricSummaryCards';

export const AdminDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'modules'>('overview');
  const [isPending, startTransition] = useTransition();

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

  const handleTabChange = (nextTab: 'overview' | 'modules') => {
    startTransition(() => {
      setActiveTab(nextTab);
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Administration Dashboard"
        description="High-level visibility into company-wide workforce operations, attendance, and compliance"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/70 mr-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'overview'}
              onClick={() => handleTabChange('overview')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Operations Hub</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'modules'}
              onClick={() => handleTabChange('modules')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'modules'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span>Admin Modules</span>
            </button>
          </div>

          <Link to="/admin/reports">
            <Button variant="outline" size="sm" className="gap-1.5 h-9 rounded-xl text-xs font-semibold">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Reports
            </Button>
          </Link>
        </div>
      </PageHeader>

      {/* Main Content with Transition Status */}
      <section
        aria-busy={isPending}
        className={`space-y-6 transition-opacity duration-200 ${
          isPending ? 'opacity-70' : 'opacity-100'
        }`}
      >
        {activeTab === 'overview' ? (
          <>
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

            {/* Operations Quick Launch */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
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
                      {metrics.today?.pendingVerification || 0} shifts awaiting verification audit across departments.
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary group-hover:gap-2 transition-all">
                    <span>Audit Pending Items</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </Card>
              </Link>

              <Link to="/admin/overtime" className="block">
                <Card className="h-full border-border/70 hover:border-primary/40 hover:shadow-md transition-all p-5 flex flex-col justify-between group">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-3 group-hover:bg-orange-500 group-hover:text-white transition-all">
                      <Clock className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-base text-foreground mb-1 group-hover:text-primary transition-colors">
                      Overtime Queue
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {metrics.today?.pendingOvertime || 0} overtime requests pending executive approval.
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary group-hover:gap-2 transition-all">
                    <span>Review Overtime</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </Card>
              </Link>

              <Link to="/admin/attendance" className="block">
                <Card className="h-full border-border/70 hover:border-primary/40 hover:shadow-md transition-all p-5 flex flex-col justify-between group">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3 group-hover:bg-blue-500 group-hover:text-white transition-all">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-base text-foreground mb-1 group-hover:text-primary transition-colors">
                      System Attendance
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {metrics.today?.punchedIn || 0} total active check-ins logged today.
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary group-hover:gap-2 transition-all">
                    <span>View Live Shift Log</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </Card>
              </Link>
            </div>
          </>
        ) : (
          /* Admin Modules Catalog */
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

            <Link to="/admin/overtime" className="block">
              <Card className="h-full border-border/70 hover:border-primary/40 hover:shadow-md transition-all p-5 flex flex-col justify-between group">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-3 group-hover:bg-orange-500 group-hover:text-white transition-all">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-foreground mb-1 group-hover:text-primary transition-colors">
                    Overtime Approvals
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Organization-wide overtime requests, review remarks, and decision audits.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary group-hover:gap-2 transition-all">
                  <span>Open Overtime Approvals</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Card>
            </Link>

            <Link to="/admin/attendance" className="block">
              <Card className="h-full border-border/70 hover:border-primary/40 hover:shadow-md transition-all p-5 flex flex-col justify-between group">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-foreground mb-1 group-hover:text-primary transition-colors">
                    System Attendance
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Complete company-wide shift log with punch timestamps, locations, and durations.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary group-hover:gap-2 transition-all">
                  <span>Browse System Attendance</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Card>
            </Link>

            <Link to="/admin/reports" className="block">
              <Card className="h-full border-border/70 hover:border-primary/40 hover:shadow-md transition-all p-5 flex flex-col justify-between group">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center mb-3 group-hover:bg-teal-500 group-hover:text-white transition-all">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-foreground mb-1 group-hover:text-primary transition-colors">
                    Reports & Export
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Generate daily attendance sheets, download certified Excel and PDF exports.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary group-hover:gap-2 transition-all">
                  <span>Generate Reports</span>
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
        )}
      </section>
    </div>
  );
};
