import React, { useState, useTransition } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  ArrowRight,
  Camera,
  FileText,
  BarChart3,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { PunchCard } from '../../components/employee/PunchCard';
import { EmployeeSummaryCards } from '../../components/employee/EmployeeSummaryCards';
import { OvertimeRequestDialog } from '../../components/employee/OvertimeRequestDialog';
import { SelfiePreviewDialog } from '../../components/employee/SelfiePreviewDialog';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { TableSkeleton } from '../../components/common/Skeletons';
import { EmptyState } from '../../components/common/EmptyState';
import { AttendanceTimeline } from '../../components/common/AttendanceTimeline';
import {
  useGetTodayAttendanceQuery,
  useGetMyAttendanceHistoryQuery,
} from '../../features/attendance/attendanceApi';
import { useGetDashboardSummaryQuery } from '../../features/dashboard/dashboardApi';
import type { Attendance, EmployeeDashboardMetrics } from '../../types/models';

export const EmployeeDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'insights'>('attendance');
  const [isPending, startTransition] = useTransition();

  const [selectedOvertimeRecord, setSelectedOvertimeRecord] =
    useState<Attendance | null>(null);
  const [selectedSelfieRecord, setSelectedSelfieRecord] =
    useState<Attendance | null>(null);

  const {
    data: todayAttendance,
    isLoading: isTodayLoading,
  } = useGetTodayAttendanceQuery();

  const {
    data: summaryData,
    isLoading: isSummaryLoading,
  } = useGetDashboardSummaryQuery();

  const {
    data: recentHistory,
    isLoading: isHistoryLoading,
  } = useGetMyAttendanceHistoryQuery({ page: 1, limit: 5 });

  const employeeMetrics = summaryData as EmployeeDashboardMetrics | undefined;

  const handleTabChange = (nextTab: 'attendance' | 'insights') => {
    startTransition(() => {
      setActiveTab(nextTab);
    });
  };

  const handleOpenOvertime = (attendance: Attendance) => {
    setSelectedOvertimeRecord(attendance);
  };

  return (
    <div className="space-y-6" data-testid="employee-dashboard-page">
      {/* Welcome Header */}
      <PageHeader
        title="Employee Dashboard"
        description="Record your daily work shift, track worked hours, and view overtime requests."
      >
        {/* View Switcher Tabs with useTransition */}
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/70" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'attendance'}
            onClick={() => handleTabChange('attendance')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'attendance'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Today's Shift</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'insights'}
            onClick={() => handleTabChange('insights')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'insights'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>30-Day Metrics</span>
          </button>
        </div>
      </PageHeader>

      {/* Main Tab Content Section with aria-busy for transition feedback */}
      <section
        aria-busy={isPending}
        className={`space-y-6 transition-opacity duration-200 ${
          isPending ? 'opacity-70' : 'opacity-100'
        }`}
      >
        {activeTab === 'attendance' ? (
          <>
            {/* Main Punch Card Section */}
            <section aria-labelledby="punch-card-heading">
              <PunchCard
                todayAttendance={todayAttendance}
                isLoading={isTodayLoading}
                onRequestOvertime={handleOpenOvertime}
              />
            </section>
          </>
        ) : (
          <>
            {/* 30-Day Metrics Overview */}
            <section aria-labelledby="summary-metrics-heading">
              <EmployeeSummaryCards
                metrics={employeeMetrics}
                isLoading={isSummaryLoading}
              />
            </section>
          </>
        )}

      {/* Recent Attendance Activity */}
      <section aria-labelledby="recent-activity-heading">
        <Card className="border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border/40 py-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Recent Shifts
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Last 5 attendance records
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="text-xs gap-1.5">
              <Link to="/employee/history">
                <span>View Full History</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            {isHistoryLoading ? (
              <div className="p-4">
                <TableSkeleton rows={5} columns={6} />
              </div>
            ) : !recentHistory?.data || recentHistory.data.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No shifts recorded yet"
                  description="Your recent punch-ins and shift history will appear here once you record attendance."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border/40">
                    <tr>
                      <th className="px-4 py-3">Work Date</th>
                      <th className="px-4 py-3">Clock-in & Out</th>
                      <th className="px-4 py-3">Shift Status</th>
                      <th className="px-4 py-3">Verification</th>
                      <th className="px-4 py-3">Overtime</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {recentHistory.data.map((record) => {
                      const isEligibleOvertime =
                        record.workingStatus === 'completed' &&
                        (record.workedMinutes ?? 0) > 480 &&
                        record.verification?.status !== 'invalid' &&
                        (record.overtime?.status === 'not_requested' ||
                          record.overtime?.status === 'rejected' ||
                          !record.overtime?.status);

                      return (
                        <tr
                          key={record.id || record._id}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          {/* Date */}
                          <td className="px-4 py-3 font-semibold whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>{record.workDate}</span>
                            </div>
                          </td>

                          {/* Clock-in & Out */}
                          <td className="px-4 py-3">
                            <AttendanceTimeline
                              punchInAt={record.punchIn?.at}
                              punchOutAt={record.punchOut?.at}
                              workedMinutes={record.workedMinutes}
                              workingStatus={record.workingStatus}
                            />
                          </td>

                          {/* Working Status */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge
                              type="working"
                              status={record.workingStatus}
                            />
                          </td>

                          {/* Verification */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="space-y-0.5">
                              <StatusBadge
                                type="verification"
                                status={record.verification?.status}
                              />
                              {record.verification?.remarks && (
                                <p className="text-[10px] text-muted-foreground max-w-[120px] truncate">
                                  {record.verification.remarks}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Overtime */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge
                              type="overtime"
                              status={record.overtime?.status}
                            />
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 whitespace-nowrap text-right space-x-2">
                            {/* View Selfies */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedSelfieRecord(record)}
                              className="h-7 px-2 text-xs"
                              title="View selfie verification photo"
                            >
                              <Camera className="w-3.5 h-3.5 mr-1" />
                              Selfie
                            </Button>

                            {/* Request Overtime */}
                            {isEligibleOvertime && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenOvertime(record)}
                                className="h-7 px-2 text-xs border-primary/40 text-primary hover:bg-primary/10"
                              >
                                <Clock className="w-3 h-3 mr-1" />
                                Overtime
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
      </section>

      {/* Overtime Request Dialog */}
      <OvertimeRequestDialog
        attendance={selectedOvertimeRecord}
        isOpen={Boolean(selectedOvertimeRecord)}
        onClose={() => setSelectedOvertimeRecord(null)}
      />

      {/* Selfie Preview Dialog */}
      <SelfiePreviewDialog
        attendance={selectedSelfieRecord}
        isOpen={Boolean(selectedSelfieRecord)}
        onClose={() => setSelectedSelfieRecord(null)}
      />
    </div>
  );
};

export default EmployeeDashboardPage;
