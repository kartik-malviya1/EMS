import React from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeletons } from '../../components/common/Skeletons';
import { ErrorState } from '../../components/common/ErrorState';
import { useGetDashboardSummaryQuery } from '../../features/dashboard/dashboardApi';
import type { AdminDashboardMetrics } from '../../types/models';
import {
  Users,
  UserCheck,
  UserX,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ArrowRight,
  Settings,
  Building2,
} from 'lucide-react';

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

  const statCards = [
    {
      title: 'Total Users',
      value: totalUsersCount,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      description: `${totalEmployees} employees • ${totalManagers} managers • ${totalAdmins} admins`,
      link: '/admin/users',
    },
    {
      title: 'Active Accounts',
      value: metrics.activeUsers || 0,
      icon: UserCheck,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      description: 'Accounts permitted to sign in and record shifts',
      link: '/admin/users',
    },
    {
      title: 'Punched In Today',
      value: metrics.today?.punchedIn || 0,
      icon: Clock,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
      description: 'Staff currently clocked in or completed today',
      link: '/admin/attendance',
    },
    {
      title: 'Completed (8h+)',
      value: metrics.today?.completed || 0,
      icon: CheckCircle2,
      color: 'text-teal-500',
      bgColor: 'bg-teal-500/10',
      description: 'Met standard full shift duration',
    },
    {
      title: 'Incomplete (<8h)',
      value: metrics.today?.incomplete || 0,
      icon: AlertTriangle,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      description: 'Punched out before 8 hours',
    },
    {
      title: 'Missed / Auto-closed',
      value: metrics.today?.missed || 0,
      icon: UserX,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
      description: 'Missed shifts or closed by system',
    },
    {
      title: 'Pending Verification',
      value: metrics.today?.pendingVerification || 0,
      icon: ShieldCheck,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
      description: 'System-wide shifts requiring photo/geofence audit',
      highlight: (metrics.today?.pendingVerification || 0) > 0,
      link: '/admin/review',
    },
    {
      title: 'Pending Overtime',
      value: metrics.today?.pendingOvertime || 0,
      icon: Clock,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      description: 'Overtime claims awaiting management decision',
      highlight: (metrics.today?.pendingOvertime || 0) > 0,
      link: '/admin/overtime',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="System Administration Dashboard"
          description="High-level visibility into company-wide workforce operations, attendance, and compliance"
        />
        <div className="flex items-center gap-2">
          <Link to="/admin/settings">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings className="w-4 h-4" /> Geofence Settings
            </Button>
          </Link>
          <Link to="/employee">
            <Button size="sm" className="gap-1.5">
              <Clock className="w-4 h-4" /> Personal Shift
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Card
              key={idx}
              className={`border transition-all duration-300 relative overflow-hidden group ${
                card.highlight
                  ? 'border-primary/40 bg-primary/5 shadow-md'
                  : 'border-border/70 hover:border-primary/30 hover:shadow-sm'
              }`}
            >
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary to-orange-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {card.title}
                  </span>
                  <div className={`p-2 rounded-xl ${card.bgColor} ${card.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold tracking-tight text-foreground">
                    {card.value}
                  </span>
                  {card.link && (
                    <Link
                      to={card.link}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                    >
                      Manage <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
