import React from 'react';
import { Card, CardContent } from '../ui/card';
import type { ReportSummary } from '../../features/reports/reportsApi';

interface ReportVisualizationsProps {
  summary: ReportSummary;
  totalRecords: number;
  periodLabel?: string;
}

export const ReportVisualizations: React.FC<ReportVisualizationsProps> = ({
  summary,
  totalRecords,
  periodLabel,
}) => {
  const ws = summary.workingStatus || { completed: 0, incomplete: 0, in_progress: 0, missed: 0 };
  const vs = summary.verificationStatus || { valid: 0, pending: 0, invalid: 0 };
  const os = summary.overtimeStatus || { not_requested: 0, pending: 0, approved: 0, rejected: 0 };

  const calcPct = (cnt: number) => (totalRecords > 0 ? Math.round((cnt / totalRecords) * 100) : 0);

  const compPct = calcPct(ws.completed || 0);
  const inProgPct = calcPct(ws.in_progress || 0);
  const incPct = calcPct(ws.incomplete || 0);
  const missedPct = Math.max(0, 100 - compPct - inProgPct - incPct);

  // Daily entries sorted chronologically
  const dateEntries = Object.entries(summary.byDate || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const maxDayCount = Math.max(...dateEntries.map((e) => e[1]), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Visualization 1: Shift Status Distribution */}
        <Card className="border-border/70 rounded-2xl shadow-xs">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                1. Shift Status Distribution
              </h4>
              <span className="text-[11px] font-medium text-muted-foreground">
                {totalRecords} Total Shifts
              </span>
            </div>

            {totalRecords === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No shift data recorded for this period.
              </div>
            ) : (
              <>
                {/* Horizontal Segmented Bar */}
                <div className="h-4 w-full bg-muted/60 rounded-full overflow-hidden flex shadow-inner">
                  {compPct > 0 && (
                    <div
                      style={{ width: `${compPct}%` }}
                      className="bg-emerald-500 h-full transition-all"
                      title={`Completed: ${ws.completed} (${compPct}%)`}
                    />
                  )}
                  {inProgPct > 0 && (
                    <div
                      style={{ width: `${inProgPct}%` }}
                      className="bg-blue-500 h-full transition-all"
                      title={`In Progress: ${ws.in_progress} (${inProgPct}%)`}
                    />
                  )}
                  {incPct > 0 && (
                    <div
                      style={{ width: `${incPct}%` }}
                      className="bg-amber-500 h-full transition-all"
                      title={`Incomplete: ${ws.incomplete} (${incPct}%)`}
                    />
                  )}
                  {missedPct > 0 && ws.missed > 0 && (
                    <div
                      style={{ width: `${missedPct}%` }}
                      className="bg-rose-500 h-full transition-all"
                      title={`Missed: ${ws.missed} (${missedPct}%)`}
                    />
                  )}
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-muted-foreground text-[11px]">
                      Completed: <strong className="text-foreground">{ws.completed}</strong> ({compPct}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                    <span className="text-muted-foreground text-[11px]">
                      In Progress: <strong className="text-foreground">{ws.in_progress}</strong> ({inProgPct}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-muted-foreground text-[11px]">
                      Incomplete: <strong className="text-foreground">{ws.incomplete}</strong> ({incPct}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                    <span className="text-muted-foreground text-[11px]">
                      Missed: <strong className="text-foreground">{ws.missed}</strong> ({calcPct(ws.missed)}%)
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Visualization 2: Attendance by Day */}
        <Card className="border-border/70 rounded-2xl shadow-xs">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                2. Attendance by Day (Daily Volume)
              </h4>
              <span className="text-[11px] font-medium text-muted-foreground">
                {periodLabel || 'Selected Range'}
              </span>
            </div>

            {dateEntries.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No day-by-day attendance data for this period.
              </div>
            ) : (
              <div className="pt-2">
                <div className="h-24 flex items-end gap-2 border-b border-border/70 pb-1 px-1 overflow-x-auto">
                  {dateEntries.map(([dt, cnt]) => {
                    const barHeightPct = Math.max(8, Math.round((cnt / maxDayCount) * 100));
                    return (
                      <div key={dt} className="flex-1 min-w-[32px] flex flex-col items-center gap-1 group">
                        <span className="text-[10px] font-bold text-primary group-hover:scale-110 transition-transform">
                          {cnt}
                        </span>
                        <div
                          style={{ height: `${barHeightPct}%` }}
                          className="w-full max-w-[28px] rounded-t-md bg-indigo-500 group-hover:bg-indigo-600 transition-colors shadow-xs"
                          title={`${dt}: ${cnt} shift(s)`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 pt-1.5 px-1 overflow-x-auto text-[10px] text-muted-foreground font-mono">
                  {dateEntries.map(([dt]) => (
                    <div key={dt} className="flex-1 min-w-[32px] text-center truncate">
                      {dt.substring(5)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Visualization 3: Verification & Overtime Audit Breakdown */}
      <Card className="border-border/70 rounded-2xl shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/60">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              3. Verification & Overtime Audit Breakdown
            </h4>
            <span className="text-[11px] text-muted-foreground">
              Deterministic Managerial & Executive Audits
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Verification Status */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Verification Status
              </span>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-emerald-600 font-semibold">Valid</span>
                    <span className="font-mono">{vs.valid}</span>
                  </div>
                  <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${calcPct(vs.valid)}%` }}
                      className="h-full bg-emerald-500 rounded-full"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-amber-600 font-semibold">Pending Audit</span>
                    <span className="font-mono">{vs.pending}</span>
                  </div>
                  <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${calcPct(vs.pending)}%` }}
                      className="h-full bg-amber-500 rounded-full"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-rose-600 font-semibold">Marked Invalid</span>
                    <span className="font-mono">{vs.invalid}</span>
                  </div>
                  <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${calcPct(vs.invalid)}%` }}
                      className="h-full bg-rose-500 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Overtime Status */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Overtime Status
              </span>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-emerald-600 font-semibold">Approved Overtime</span>
                    <span className="font-mono">{os.approved}</span>
                  </div>
                  <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${calcPct(os.approved)}%` }}
                      className="h-full bg-emerald-500 rounded-full"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-amber-600 font-semibold">Pending Review</span>
                    <span className="font-mono">{os.pending}</span>
                  </div>
                  <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${calcPct(os.pending)}%` }}
                      className="h-full bg-amber-500 rounded-full"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500 font-semibold">Rejected Overtime</span>
                    <span className="font-mono">{os.rejected}</span>
                  </div>
                  <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${calcPct(os.rejected)}%` }}
                      className="h-full bg-slate-400 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
