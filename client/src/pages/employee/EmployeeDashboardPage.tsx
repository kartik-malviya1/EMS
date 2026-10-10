import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  ArrowRight,
  Camera,
  FileText,
} from 'lucide-react';
import { DateTime } from 'luxon';
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
import {
  useGetTodayAttendanceQuery,
  useGetMyAttendanceHistoryQuery,
} from '../../features/attendance/attendanceApi';
import { useGetDashboardSummaryQuery } from '../../features/dashboard/dashboardApi';
import type { Attendance, EmployeeDashboardMetrics } from '../../types/models';

export const EmployeeDashboardPage: React.FC = () => {
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

  const handleOpenOvertime = (attendance: Attendance) => {
    setSelectedOvertimeRecord(attendance);
  };

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '--:--';
    return DateTime.fromISO(isoString).toFormat('hh:mm a');
  };

  const formatMinutes = (minutes?: number | null) => {
    if (minutes === undefined || minutes === null) return '--';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-8" data-testid="employee-dashboard-page">
      {/* Welcome Header */}
      <PageHeader
        title="Employee Dashboard"
        description="Record your daily work shift, track worked hours, and view overtime requests."
      />

      {/* Main Punch Card Section */}
      <section aria-labelledby="punch-card-heading">
        <PunchCard
          todayAttendance={todayAttendance}
          isLoading={isTodayLoading}
          onRequestOvertime={handleOpenOvertime}
        />
      </section>

      {/* 30-Day Metrics Overview */}
      <section aria-labelledby="summary-metrics-heading">
        <EmployeeSummaryCards
          metrics={employeeMetrics}
          isLoading={isSummaryLoading}
        />
      </section>

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
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Punch In</th>
                      <th className="px-4 py-3">Punch Out</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">Status</th>
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
                          <td className="px-4 py-3 font-medium whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>{record.workDate}</span>
                            </div>
                          </td>

                          {/* Punch In */}
                          <td className="px-4 py-3 whitespace-nowrap font-mono">
                            {formatTime(record.punchIn?.at)}
                          </td>

                          {/* Punch Out */}
                          <td className="px-4 py-3 whitespace-nowrap font-mono">
                            {formatTime(record.punchOut?.at)}
                          </td>

                          {/* Worked Duration */}
                          <td className="px-4 py-3 whitespace-nowrap font-mono font-medium">
                            {formatMinutes(record.workedMinutes)}
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
