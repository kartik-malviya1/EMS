import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Skeletons } from '../../components/common/Skeletons';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { AttendanceReviewDialog } from '../../components/review/AttendanceReviewDialog';
import { useGetAllAttendanceQuery } from '../../features/attendance/attendanceApi';
import type { Attendance, User } from '../../types/models';
import { ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';

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
      <PageHeader
        title="System-Wide Verification Queue"
        description="Audit closed attendance shifts across all departments and managers"
      />

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
          title="No pending verifications"
          description="All closed attendance records have been verified across the organization."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviewableRecords.map((rec) => {
              const emp =
                typeof rec.employeeId === 'object' && rec.employeeId !== null
                  ? (rec.employeeId as User)
                  : null;
              const recId = rec.id || rec._id;

              return (
                <Card
                  key={recId}
                  className="border-border/70 hover:border-primary/40 hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-foreground">
                          {emp?.name || 'Staff Member'}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {emp?.email} •{' '}
                          <span className="capitalize">{emp?.role}</span>
                        </p>
                      </div>
                      <StatusBadge
                        kind="working"
                        status={rec.workingStatus}
                        size="sm"
                      />
                    </div>

                    <div className="rounded-xl bg-muted/30 p-2.5 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Work Date:</span>
                        <span className="font-medium text-foreground">
                          {rec.workDate}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Duration:</span>
                        <span className="font-medium text-foreground">
                          {rec.workedMinutes != null
                            ? `${rec.workedMinutes} mins (${(rec.workedMinutes / 60).toFixed(2)} hrs)`
                            : 'Incomplete'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Punch In:</span>
                        <span className="font-medium text-foreground">
                          {rec.punchIn?.at
                            ? new Date(rec.punchIn.at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Punch Out:</span>
                        <span className="font-medium text-foreground">
                          {rec.punchOut?.at
                            ? new Date(rec.punchOut.at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      className="w-full gap-1.5 text-xs"
                      onClick={() => {
                        setSelectedRecord(rec);
                        setDialogOpen(true);
                      }}
                    >
                      <ShieldCheck className="w-4 h-4" /> Audit Verification
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="p-3 border border-border/70 rounded-xl flex items-center justify-between text-xs text-muted-foreground bg-card">
              <span>
                Page {meta.page} of {meta.totalPages} ({meta.total} records)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={meta.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verification Review Dialog */}
      <AttendanceReviewDialog
        attendance={selectedRecord}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={refetch}
      />
    </div>
  );
};
