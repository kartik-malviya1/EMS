import React, { useState, useEffect, useTransition } from 'react';
import {
  useGetInvitationsQuery,
  useResendInvitationMutation,
  useRevokeInvitationMutation,
} from '../../features/invitations/invitationsApi';
import type { Invitation, InvitationStatus } from '../../types/models';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeletons } from '../common/Skeletons';
import { EmptyState } from '../common/EmptyState';
import { ErrorState } from '../common/ErrorState';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import {
  Search,
  RotateCcw,
  RefreshCw,
  Ban,
  Briefcase,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../lib/utils';

export const InvitationsTable: React.FC = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  // Cooldown countdown timers keyed by invitationId
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  // Track in-flight resend IDs
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Dev link modal when resending in development mode
  const [devLinkModal, setDevLinkModal] = useState<{ open: boolean; link: string; email: string }>({
    open: false,
    link: '',
    email: '',
  });
  const [hasCopiedDevLink, setHasCopiedDevLink] = useState(false);

  const queryParams = {
    search: search.trim() || undefined,
    status: status || undefined,
    page,
    limit: 15,
  };

  const { data, isLoading, isError, refetch } = useGetInvitationsQuery(queryParams);
  const [resendInvitation] = useResendInvitationMutation();
  const [revokeInvitation, { isLoading: isRevoking }] = useRevokeInvitationMutation();

  const invitations = data?.data || [];
  const meta = data?.meta;

  // Countdown timer effect for cooldowns
  useEffect(() => {
    const activeKeys = Object.keys(cooldowns).filter((k) => (cooldowns[k] || 0) > 0);
    if (activeKeys.length === 0) return;

    const timer = setInterval(() => {
      setCooldowns((prev) => {
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v > 1) {
            next[k] = v - 1;
          }
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldowns]);

  const handleResetFilters = () => {
    setSearch('');
    startTransition(() => {
      setStatus('');
      setPage(1);
    });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    startTransition(() => {
      setStatus(val);
      setPage(1);
    });
  };

  const handlePageChange = (newPage: number) => {
    startTransition(() => {
      setPage(newPage);
    });
  };

  const handleResend = async (id: string, email: string) => {
    if (resendingId || (cooldowns[id] && cooldowns[id] > 0)) {
      return;
    }

    setResendingId(id);
    try {
      const res = await resendInvitation(id).unwrap();

      if (res.email?.status === 'accepted') {
        toast.success(`Invitation resent to ${email}. Accepted by Resend.`);
      } else if (res.devInvitationLink) {
        toast.success(`Fresh development invitation link generated.`);
        setDevLinkModal({ open: true, link: res.devInvitationLink, email });
      } else {
        toast.success(`Invitation processed for ${email}`);
      }
    } catch (err: unknown) {
      const payload = err as {
        status?: number;
        data?: { error?: { code?: string; message?: string; details?: { retryAfterSeconds?: number } } };
      };

      const errorObj = payload?.data?.error;
      const retryAfter = errorObj?.details?.retryAfterSeconds;

      if (retryAfter && retryAfter > 0) {
        setCooldowns((prev) => ({ ...prev, [id]: retryAfter }));
      } else if (payload?.status === 429) {
        setCooldowns((prev) => ({ ...prev, [id]: 60 }));
      }

      const msg = getApiErrorMessage(err, 'Failed to resend invitation email.');
      toast.error(msg);
    } finally {
      setResendingId(null);
    }
  };

  const handleRevoke = async (id: string, email: string) => {
    if (!window.confirm(`Are you sure you want to revoke the invitation for ${email}?`)) {
      return;
    }
    try {
      await revokeInvitation(id).unwrap();
      toast.success(`Invitation for ${email} has been revoked`);
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'Failed to revoke invitation');
      toast.error(msg);
    }
  };

  const renderStatusBadge = (invStatus: InvitationStatus) => {
    switch (invStatus) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Accepted
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            <AlertTriangle className="w-3 h-3" /> Expired
          </span>
        );
      case 'revoked':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" /> Revoked
          </span>
        );
      default:
        return <span>{invStatus}</span>;
    }
  };

  const renderDeliveryBadge = (inv: Invitation) => {
    const deliveryStatus = inv.emailDeliveryStatus;
    const error = inv.emailLastError;

    switch (deliveryStatus) {
      case 'accepted':
        return (
          <div className="space-y-0.5">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              title="Accepted by Resend. Inbox delivery is not confirmed."
            >
              <Send className="w-2.5 h-2.5" /> Accepted
            </span>
            <div className="text-[10px] text-muted-foreground">Accepted by Resend</div>
          </div>
        );
      case 'failed':
        return (
          <div className="space-y-0.5 max-w-[200px]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-2.5 h-2.5" /> Email Failed
            </span>
            {error?.message && (
              <div
                className="text-[10px] text-destructive leading-tight truncate"
                title={`${error.message}${error.outcomeUnknown ? ' (It may still arrive; retry reuses the same request)' : ''}`}
              >
                {error.message}
              </div>
            )}
            {error?.outcomeUnknown && (
              <div className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
                Delivery outcome unconfirmed
              </div>
            )}
          </div>
        );
      case 'dev_link':
        return (
          <div className="space-y-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <Send className="w-2.5 h-2.5" /> Dev Link
            </span>
            <div className="text-[10px] text-muted-foreground">Local simulated</div>
          </div>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-500/10 text-slate-500">
            <Clock className="w-2.5 h-2.5" /> Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search invitation by name or email..."
            className="pl-9 h-9 text-xs rounded-xl"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={handleStatusChange}
            className="h-9 rounded-xl border border-input bg-card px-3 text-xs font-medium focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Invitation Statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="h-9 text-xs gap-1 rounded-xl"
            title="Reset filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Invitations Table */}
      {isLoading ? (
        <Skeletons count={5} />
      ) : isError ? (
        <ErrorState
          title="Could not load invitations"
          message="Failed to retrieve invitation records. Please retry."
          onRetry={refetch}
        />
      ) : invitations.length === 0 ? (
        <EmptyState
          title="No invitations found"
          description="Use the 'Invite User' action to issue a new employee or manager invitation."
        />
      ) : (
        <section
          aria-busy={isPending}
          className={`space-y-4 transition-opacity duration-150 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <div className="border border-border/70 rounded-2xl bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase tracking-wider font-bold text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Invited Recipient</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Department / Title</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Email Delivery</th>
                    <th className="py-3.5 px-4">Expires At</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {invitations.map((inv) => {
                    const invId = inv.id || inv._id || '';
                    const isPendingOrExpired = inv.status === 'pending' || inv.status === 'expired';
                    const isAccepted = inv.status === 'accepted';
                    const isThisResending = resendingId === invId;
                    const cooldown = cooldowns[invId] || 0;
                    const isResendDisabled = isThisResending || cooldown > 0;

                    return (
                      <tr key={invId} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">{inv.name}</div>
                          <div className="text-[11px] text-muted-foreground">{inv.email}</div>
                          {inv.employeeId && (
                            <div className="text-[10px] font-mono text-muted-foreground/80 mt-0.5">
                              ID: {inv.employeeId}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {inv.role === 'manager' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              <Briefcase className="w-3 h-3" /> Manager
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                              <UserIcon className="w-3 h-3" /> Employee
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {inv.department || inv.designation ? (
                            <div>
                              <div className="font-medium text-foreground">{inv.designation || 'Staff'}</div>
                              <div className="text-[11px]">{inv.department || 'General'}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">{renderStatusBadge(inv.status)}</td>
                        <td className="py-3 px-4">
                          {renderDeliveryBadge(inv)}
                          {inv.resendCount && inv.resendCount > 0 ? (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Resent {inv.resendCount} {inv.resendCount === 1 ? 'time' : 'times'}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                          {new Date(inv.expiresAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPendingOrExpired && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isResendDisabled}
                                onClick={() => handleResend(invId, inv.email)}
                                className="h-7 text-xs rounded-lg gap-1 hover:border-primary hover:text-primary"
                                title="Issue fresh token and resend invitation email"
                              >
                                {isThisResending ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Sending...</span>
                                  </>
                                ) : cooldown > 0 ? (
                                  <>
                                    <Clock className="w-3 h-3" />
                                    <span>{cooldown}s</span>
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Resend</span>
                                  </>
                                )}
                              </Button>
                            )}

                            {inv.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isRevoking}
                                onClick={() => handleRevoke(invId, inv.email)}
                                className="h-7 text-xs rounded-lg gap-1 text-destructive hover:bg-destructive/10"
                                title="Revoke this invitation"
                              >
                                <Ban className="w-3 h-3" /> Revoke
                              </Button>
                            )}

                            {isAccepted && (
                              <span className="text-[11px] text-emerald-600 font-medium px-2 py-0.5">
                                Active User
                              </span>
                            )}
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
                  Showing Page {meta.page} of {meta.totalPages} ({meta.total} invitations total)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs rounded-lg"
                    disabled={meta.page <= 1}
                    onClick={() => handlePageChange(Math.max(1, meta.page - 1))}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs rounded-lg"
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => handlePageChange(meta.page + 1)}
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Dev Link Resend Modal */}
      {devLinkModal.open && (
        <Dialog
          open={devLinkModal.open}
          onOpenChange={(open) => setDevLinkModal((prev) => ({ ...prev, open }))}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Send className="w-4 h-4 text-amber-600" /> Fresh Dev Invitation Link
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                In Development mode, no live email was sent. A fresh invitation token was generated for{' '}
                <strong>{devLinkModal.email}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2 mt-2">
              <p className="text-[11px] text-muted-foreground">
                Link shown once. Resending generates a new link.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={devLinkModal.link}
                  className="font-mono text-[11px] h-8 bg-background"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(devLinkModal.link);
                      setHasCopiedDevLink(true);
                      toast.success('Link copied to clipboard');
                      setTimeout(() => setHasCopiedDevLink(false), 2000);
                    } catch {
                      toast.error('Failed to copy');
                    }
                  }}
                  className="h-8 gap-1 shrink-0 text-xs"
                >
                  {hasCopiedDevLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                size="sm"
                onClick={() => setDevLinkModal({ open: false, link: '', email: '' })}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default InvitationsTable;
