import React from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeletons } from '../../components/common/Skeletons';
import { ErrorState } from '../../components/common/ErrorState';
import { useGetDashboardSummaryQuery } from '../../features/dashboard/dashboardApi';
import type { ManagerDashboardMetrics } from '../../types/models';
import {
  Users,
  UserCheck,
  UserX,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ArrowRight,
  Calendar,
  FileSpreadsheet,
} from 'lucide-react';

export const ManagerDashboardPage: React.FC = () => {
  const { data, isLoading, isError, refetch } = useGetDashboardSummaryQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Team Management Overview"
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
          title="Team Management Overview"
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

  const statCards = [
    {
      title: 'Total Team Size',
      value: metrics.teamSize,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      description: 'Active assigned team members',
    },
    {
      title: 'Punched In Today',
      value: metrics.punchedIn,
      icon: UserCheck,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      description: 'Currently on duty or completed shift',
    },
    {
      title: 'Not Yet Punched In',
      value: metrics.notYetPunchedIn,
      icon: UserX,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      description: 'Pending check-in for today',
    },
    {
      title: 'Completed Shifts',
      value: metrics.completed,
      icon: CheckCircle2,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
      description: 'Reached standard 8+ hours',
    },
    {
      title: 'Incomplete Shifts',
      value: metrics.incomplete,
      icon: AlertTriangle,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
      description: 'Punched out under 8 hours',
    },
    {
      title: 'Pending Verification',
      value: metrics.pendingVerification,
      icon: ShieldCheck,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
      description: 'Awaiting your audit & approval',
      highlight: metrics.pendingVerification > 0,
      link: '/manager/review',
    },
    {
      title: 'Pending Overtime',
      value: metrics.pendingOvertime,
      icon: Clock,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      description: 'Overtime requests needing action',
      highlight: metrics.pendingOvertime > 0,
      link: '/manager/overtime',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Team Management Dashboard"
          description="Real-time shift tracking, attendance auditing, and overtime management for your team"
        />
        <div className="flex items-center gap-2">
          <Link to="/manager/reports">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FileSpreadsheet className="w-4 h-4" /> Reports
            </Button>
          </Link>
          <Link to="/employee">
            <Button size="sm" className="gap-1.5">
              <Clock className="w-4 h-4" /> My Personal Shift
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
                      View queue <ArrowRight className="w-3 h-3" />
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
