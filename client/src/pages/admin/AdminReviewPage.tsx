import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Skeletons } from '../../components/common/Skeletons';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { AttendanceReviewDialog } from '../../components/review/AttendanceReviewDialog';
import { EmployeeCell } from '../../components/common/EmployeeCell';
import { AttendanceTimeline } from '../../components/common/AttendanceTimeline';
import { useGetAllAttendanceQuery } from '../../features/attendance/attendanceApi';
import type { Attendance, User } from '../../types/models';
import { ShieldCheck, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';

export const AdminReviewPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useGetAllAttendanceQuery({
    verificationStatus: 'pending',
    page,
    limit: 20,
  });

  const meta = data?.meta;

  // Only closed shifts can be verified
  const reviewableRecords = (data?.data || []).filter(
    (rec) => rec.workingStatus !== 'in_progress'
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <PageHeader
            title="System-Wide Verification Queue"
            description="Audit employee attendance selfies, location geofences, and working hours compliance"
          />
        </div>
        {reviewableRecords.length > 0 && (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
            {reviewableRecords.length} Shifts Pending Audit
          </span>
        )}
      </div>

      {isLoading ? (
        <Skeletons count={4} />
      ) : isError ? (
        <ErrorState
          title="Could not load verification queue"
          message="Failed to retrieve pending verifications. Please try again."
          onRetry={refetch}
        />
      ) : reviewableRecords.length === 0 ? (
        <EmptyState
          title="Verification queue is all caught up!"
          description="All closed attendance records have been verified across the organization."
        />
      ) : (
        <div className="space-y-4">
          <div className="border border-border/70 rounded-2xl bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase tracking-wider font-bold text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-4">Work Date</th>
                    <th className="py-3.5 px-4">Clock-in & Out</th>
                    <th className="py-3.5 px-4">Geofence Location</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {reviewableRecords.map((rec) => {
                    const emp =
                      typeof rec.employeeId === 'object' && rec.employeeId !== null
                        ? (rec.employeeId as User)
                        : null;
                    const recId = rec.id || rec._id || '';
                    const dist = rec.punchIn?.location?.distanceFromOfficeMeters;
                    const inGeofence = rec.punchIn?.location?.withinGeofence;

                    return (
                      <tr
                        key={recId}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <EmployeeCell employee={emp} />
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-foreground whitespace-nowrap">
                          {rec.workDate}
                        </td>
                        <td className="py-3.5 px-4">
                          <AttendanceTimeline
                            punchInAt={rec.punchIn?.at}
                            punchOutAt={rec.punchOut?.at}
                            workedMinutes={rec.workedMinutes}
                            workingStatus={rec.workingStatus}
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-muted/60 border border-border/60">
                            <MapPin className="w-3 h-3 text-primary shrink-0" />
                            <span>
                              {dist != null ? `${Math.round(dist)}m` : '—'}
                              {inGeofence ? ' (In Office)' : ' (Outside)'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge
                            kind="verification"
                            status={rec.verification?.status || 'pending'}
                            size="sm"
                          />
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            size="sm"
                            className="h-8 rounded-xl text-xs font-semibold gap-1.5 shadow-sm"
                            onClick={() => {
                              setSelectedRecord(rec);
                              setDialogOpen(true);
                            }}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" /> Audit & Verify
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {meta && meta.totalPages > 1 && (
              <div className="p-3 border-t border-border/70 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
                <span>
                  Showing Page {meta.page} of {meta.totalPages} ({meta.total} records total)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs rounded-lg"
                    disabled={meta.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs rounded-lg"
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review Dialog */}
      <AttendanceReviewDialog
        attendance={selectedRecord}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={refetch}
      />
    </div>
  );
};
