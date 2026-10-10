import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Skeletons } from '../../components/common/Skeletons';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { OvertimeReviewDialog } from '../../components/overtime/OvertimeReviewDialog';
import { useGetPendingOvertimeQuery } from '../../features/attendance/attendanceApi';
import type { Attendance, User } from '../../types/models';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';

export const ManagerOvertimePage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useGetPendingOvertimeQuery({
    page,
    limit: 15,
  });

  const records = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending Overtime Requests"
        description="Review and act on overtime requests submitted by your team for shifts exceeding 8 hours"
      />

      {isLoading ? (
        <Skeletons count={4} />
      ) : isError ? (
        <ErrorState
          title="Could not load overtime requests"
          message="Failed to retrieve pending overtime requests. Please try again."
          onRetry={refetch}
        />
      ) : records.length === 0 ? (
        <EmptyState
          title="No pending overtime requests"
          description="There are currently no team overtime requests awaiting your review."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {records.map((rec) => {
              const emp =
                typeof rec.employeeId === 'object' && rec.employeeId !== null
                  ? (rec.employeeId as User)
                  : null;
              const recId = rec.id || rec._id;
              const reqMinutes = rec.overtime?.requestedMinutes || 0;

              return (
                <Card
                  key={recId}
                  className="border-border/70 hover:border-primary/40 hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-foreground">
                          {emp?.name || 'Employee'}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {emp?.email}
                        </p>
                      </div>
                      <StatusBadge
                        kind="overtime"
                        status="pending"
                        size="sm"
                      />
                    </div>

                    <div className="rounded-xl bg-muted/30 p-2.5 text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Work Date:</span>
                        <span className="font-medium text-foreground">
                          {rec.workDate}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Shift:</span>
                        <span className="font-medium text-foreground">
                          {rec.workedMinutes != null
                            ? `${rec.workedMinutes} mins (${(rec.workedMinutes / 60).toFixed(2)} hrs)`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Requested:</span>
                        <span className="font-bold text-primary">
                          +{reqMinutes} mins ({(reqMinutes / 60).toFixed(2)} hrs)
                        </span>
                      </div>
                      <div className="pt-1 border-t border-border/60">
                        <span className="text-muted-foreground block text-[11px] mb-0.5">
                          Reason:
                        </span>
                        <p className="italic text-foreground line-clamp-2">
                          &quot;{rec.overtime?.reason || 'No reason provided'}&quot;
                        </p>
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
                      <Clock className="w-4 h-4" /> Review Overtime
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="p-3 border border-border/70 rounded-xl flex items-center justify-between text-xs text-muted-foreground bg-card">
              <span>
                Page {meta.page} of {meta.totalPages} ({meta.total} requests)
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

      {/* Overtime Review Dialog */}
      <OvertimeReviewDialog
        attendance={selectedRecord}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={refetch}
      />
    </div>
  );
};
