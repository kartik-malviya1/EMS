import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Camera,
  RotateCcw,
  MapPin,
} from 'lucide-react';
import { DateTime } from 'luxon';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable, type Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { OvertimeRequestDialog } from '../../components/employee/OvertimeRequestDialog';
import { SelfiePreviewDialog } from '../../components/employee/SelfiePreviewDialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import { useGetMyAttendanceHistoryQuery } from '../../features/attendance/attendanceApi';
import type { Attendance } from '../../types/models';

export const EmployeeHistoryPage: React.FC = () => {
  const [page, setPage] = useState<number>(1);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [workingStatus, setWorkingStatus] = useState<string>('');

  const [selectedOvertimeRecord, setSelectedOvertimeRecord] =
    useState<Attendance | null>(null);
  const [selectedSelfieRecord, setSelectedSelfieRecord] =
    useState<Attendance | null>(null);

  const queryParams = {
    page,
    limit: 10,
    ...(fromDate ? { from: fromDate } : {}),
    ...(toDate ? { to: toDate } : {}),
    ...(workingStatus ? { workingStatus } : {}),
  };

  const { data, isLoading } = useGetMyAttendanceHistoryQuery(queryParams);

  const resetFilters = () => {
    setFromDate('');
    setToDate('');
    setWorkingStatus('');
    setPage(1);
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

  const columns: Column<Attendance>[] = [
    {
      header: 'Work Date',
      cell: (row) => (
        <div className="flex items-center gap-2 font-medium whitespace-nowrap">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{row.workDate}</span>
        </div>
      ),
    },
    {
      header: 'Punch In',
      cell: (row) => (
        <div className="space-y-0.5 whitespace-nowrap">
          <div className="font-mono text-xs font-medium">
            {formatTime(row.punchIn?.at)}
          </div>
          {row.punchIn?.location && (
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 text-emerald-500" />
              <span>±{Math.round(row.punchIn.location.accuracy)}m</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Punch Out',
      cell: (row) => (
        <div className="space-y-0.5 whitespace-nowrap">
          <div className="font-mono text-xs font-medium">
            {formatTime(row.punchOut?.at)}
          </div>
          {row.punchOut?.location && (
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 text-amber-500" />
              <span>±{Math.round(row.punchOut.location.accuracy)}m</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Duration',
      cell: (row) => (
        <span className="font-mono font-medium whitespace-nowrap">
          {formatMinutes(row.workedMinutes)}
        </span>
      ),
    },
    {
      header: 'Shift Status',
      cell: (row) => (
        <StatusBadge type="working" status={row.workingStatus} />
      ),
    },
    {
      header: 'Verification',
      cell: (row) => (
        <div className="space-y-0.5">
          <StatusBadge
            type="verification"
            status={row.verification?.status}
          />
          {row.verification?.remarks && (
            <p className="text-[11px] text-muted-foreground max-w-[140px] truncate" title={row.verification.remarks}>
              "{row.verification.remarks}"
            </p>
          )}
        </div>
      ),
    },
    {
      header: 'Overtime',
      cell: (row) => (
        <div className="space-y-0.5">
          <StatusBadge type="overtime" status={row.overtime?.status} />
          {row.overtime?.requestedMinutes ? (
            <span className="text-[11px] font-mono text-muted-foreground block">
              {row.overtime.requestedMinutes} min
            </span>
          ) : null}
        </div>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (row) => {
        const isEligibleOvertime =
          row.workingStatus === 'completed' &&
          (row.workedMinutes ?? 0) > 480 &&
          row.verification?.status !== 'invalid' &&
          (row.overtime?.status === 'not_requested' ||
            row.overtime?.status === 'rejected' ||
            !row.overtime?.status);

        return (
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedSelfieRecord(row)}
              className="h-7 px-2 text-xs"
              title="View selfie verification photo"
            >
              <Camera className="w-3.5 h-3.5 mr-1" />
              Selfie
            </Button>

            {isEligibleOvertime && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedOvertimeRecord(row)}
                className="h-7 px-2 text-xs border-primary/40 text-primary hover:bg-primary/10"
              >
                <Clock className="w-3 h-3 mr-1" />
                Overtime
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6" data-testid="employee-history-page">
      <PageHeader
        title="Attendance History"
        description="View past shifts, verify recorded punch timestamps and location accuracy, and manage overtime requests."
      />

      {/* Filter Toolbar */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 max-w-3xl">
              {/* From Date */}
              <div className="space-y-1.5">
                <Label htmlFor="from-date" className="text-xs font-medium">
                  From Date
                </Label>
                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 text-xs"
                />
              </div>

              {/* To Date */}
              <div className="space-y-1.5">
                <Label htmlFor="to-date" className="text-xs font-medium">
                  To Date
                </Label>
                <Input
                  id="to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 text-xs"
                />
              </div>

              {/* Working Status Filter */}
              <div className="space-y-1.5">
                <Label htmlFor="status-select" className="text-xs font-medium">
                  Shift Status
                </Label>
                <select
                  id="status-select"
                  value={workingStatus}
                  onChange={(e) => {
                    setWorkingStatus(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">All Statuses</option>
                  <option value="completed">Completed (≥ 8h)</option>
                  <option value="incomplete">Incomplete (&lt; 8h)</option>
                  <option value="in_progress">In Progress</option>
                  <option value="missed">Missed (Auto-closed)</option>
                </select>
              </div>
            </div>

            {/* Reset Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetFilters}
              disabled={!fromDate && !toDate && !workingStatus}
              className="text-xs h-9 gap-1.5 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Data Table */}
      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={(newPage) => setPage(newPage)}
        emptyTitle="No attendance records found"
        emptyDescription="No attendance records match your current filter criteria."
      />

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

export default EmployeeHistoryPage;
