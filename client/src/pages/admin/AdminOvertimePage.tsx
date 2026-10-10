import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/ui/button';
import { Skeletons } from '../../components/common/Skeletons';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { OvertimeReviewDialog } from '../../components/overtime/OvertimeReviewDialog';
import { EmployeeCell } from '../../components/common/EmployeeCell';
import { useGetPendingOvertimeQuery } from '../../features/attendance/attendanceApi';
import type { Attendance, User } from '../../types/models';
import { Check, X, ChevronLeft, ChevronRight } from 'lucide-react';

export const AdminOvertimePage: React.FC = () => {
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <PageHeader
            title="Permission & Overtime Requests"
            description="System-wide queue for overtime permissions submitted by employees across the organization"
          />
        </div>
        {records.length > 0 && (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            {records.length} Pending Approval
          </span>
        )}
      </div>

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
          description="There are currently no overtime requests awaiting review across the organization."
        />
      ) : (
        <div className="space-y-4">
          <div className="border border-border/70 rounded-2xl bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase tracking-wider font-bold text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">ID</th>
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-4">Shift Date</th>
                    <th className="py-3.5 px-4">Duration</th>
                    <th className="py-3.5 px-4">Permission Details</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {records.map((rec) => {
                    const emp =
                      typeof rec.employeeId === 'object' && rec.employeeId !== null
                        ? (rec.employeeId as User)
                        : null;
                    const recId = rec.id || rec._id || '';
                    const shortId = recId.slice(-5).toUpperCase();
                    const reqMinutes = rec.overtime?.requestedMinutes || 0;
                    const durationHours = (reqMinutes / 60).toFixed(1);

                    return (
                      <tr
                        key={recId}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono text-muted-foreground">
                          #{shortId}
                        </td>
                        <td className="py-3.5 px-4">
                          <EmployeeCell employee={emp} />
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-foreground whitespace-nowrap">
                          {rec.workDate}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10">
                            +{reqMinutes} mins ({durationHours}h)
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <p
                            className="text-muted-foreground truncate"
                            title={rec.overtime?.reason || undefined}
                          >
                            {rec.overtime?.reason || 'Extra shift hours'}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedRecord(rec);
                                setDialogOpen(true);
                              }}
                              className="h-8 px-3 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedRecord(rec);
                                setDialogOpen(true);
                              }}
                              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Reject / Details"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
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
                  Showing Page {meta.page} of {meta.totalPages} ({meta.total} requests total)
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
