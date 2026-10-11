import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeletons } from '../../components/common/Skeletons';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmployeeCell } from '../../components/common/EmployeeCell';
import { TabNavigation, type TabItem } from '../../components/common/TabNavigation';
import { InviteTeamMemberDialog } from '../../components/users/InviteTeamMemberDialog';
import { useGetTeamUsersQuery } from '../../features/users/usersApi';
import {
  useGetTeamInvitationsQuery,
  useResendTeamInvitationMutation,
  useRevokeTeamInvitationMutation,
  useCheckTeamDeliveryMutation,
} from '../../features/invitations/invitationsApi';
import type { AccountStatus, InvitationStatus } from '../../types/models';
import { formatLastEvent } from '../../lib/formatLastEvent';
import { getApiErrorMessage } from '../../lib/utils';
import { toast } from 'sonner';
import {
  UserPlus,
  Search,
  RotateCcw,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Send,
  Ban,
  Activity,
  Loader2,
} from 'lucide-react';

export const ManagerTeamPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Cooldown countdown timers keyed by invitationId
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [checkingDeliveryId, setCheckingDeliveryId] = useState<string | null>(null);

  // Queries
  const {
    data: teamMembers = [],
    isLoading: isMembersLoading,
    isError: isMembersError,
    isFetching: isMembersFetching,
    refetch: refetchMembers,
  } = useGetTeamUsersQuery(statusFilter ? { status: statusFilter } : undefined);

  const {
    data: invitationsData,
    isLoading: isInvitationsLoading,
    isError: isInvitationsError,
    isFetching: isInvitationsFetching,
    refetch: refetchInvitations,
  } = useGetTeamInvitationsQuery(
    activeTab === 'invitations'
      ? {
          status: statusFilter || undefined,
          search: search.trim() || undefined,
        }
      : undefined
  );

  // Mutations
  const [resendInvitation] = useResendTeamInvitationMutation();
  const [revokeInvitation, { isLoading: isRevoking }] = useRevokeTeamInvitationMutation();
  const [checkDelivery] = useCheckTeamDeliveryMutation();

  // Cooldown timer interval
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
    setStatusFilter('');
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
  };

  const handleResend = async (invitationId: string, email: string) => {
    if (resendingId || (cooldowns[invitationId] && cooldowns[invitationId] > 0)) {
      return;
    }

    setResendingId(invitationId);
    try {
      const res = await resendInvitation(invitationId).unwrap();
      if (res.email?.status === 'accepted') {
        toast.success(`Invitation re-sent and accepted by provider for ${email}.`);
      } else {
        toast.success(`Invitation re-sent for ${email}.`);
      }
    } catch (err: unknown) {
      const payload = err as {
        status?: number;
        data?: {
          error?: {
            details?: { retryAfterSeconds?: number };
          };
        };
      };
      const retryAfter = payload?.data?.error?.details?.retryAfterSeconds;
      if (retryAfter && retryAfter > 0) {
        setCooldowns((prev) => ({ ...prev, [invitationId]: retryAfter }));
      } else if (payload?.status === 429) {
        setCooldowns((prev) => ({ ...prev, [invitationId]: 60 }));
      }
      const msg = getApiErrorMessage(err, 'Failed to resend invitation.');
      toast.error(msg);
    } finally {
      setResendingId(null);
    }
  };

  const handleRevoke = async (invitationId: string, email: string) => {
    if (!window.confirm(`Are you sure you want to revoke the invitation for ${email}?`)) {
      return;
    }
    try {
      await revokeInvitation(invitationId).unwrap();
      toast.success(`Invitation for ${email} has been revoked.`);
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'Failed to revoke invitation.');
      toast.error(msg);
    }
  };

  const handleCheckDelivery = async (invitationId: string, email: string) => {
    if (checkingDeliveryId === invitationId) return;
    setCheckingDeliveryId(invitationId);
    try {
      const res = await checkDelivery(invitationId).unwrap();
      const eventInfo = formatLastEvent(res.lastEvent);
      toast.success(`Delivery status for ${email}: ${eventInfo.label}`);
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'Failed to verify delivery status.');
      toast.error(msg);
    } finally {
      setCheckingDeliveryId(null);
    }
  };

  // Filtered members for local search
  const filteredMembers = teamMembers.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.employeeId && m.employeeId.toLowerCase().includes(q))
    );
  });

  const invitations = invitationsData?.data || [];

  const tabs: TabItem[] = [
    { id: 'members', label: 'Team Members', count: teamMembers.length },
    { id: 'invitations', label: 'Invitations & Delivery', count: invitationsData?.meta?.total },
  ];

  const renderAccountStatusBadge = (status?: AccountStatus, statusLabel?: string) => {
    if (status === 'invited') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Clock className="w-3 h-3" /> {statusLabel || 'Invited — pending activation'}
        </span>
      );
    }
    if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" /> Active
        </span>
      );
    }
    if (status === 'suspended') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
          <AlertTriangle className="w-3 h-3" /> Suspended
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
        {status || 'Unknown'}
      </span>
    );
  };

  const renderInvitationStatusBadge = (invStatus: InvitationStatus) => {
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

  const renderDeliveryBadge = (deliveryStatus?: string, lastEvent?: string | null) => {
    if (deliveryStatus === 'accepted') {
      const eventInfo = lastEvent ? formatLastEvent(lastEvent) : null;
      return (
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 w-fit">
            <Send className="w-2.5 h-2.5" /> Accepted
          </span>
          {eventInfo && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {eventInfo.label}
            </span>
          )}
        </div>
      );
    }
    if (deliveryStatus === 'failed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 w-fit">
          <AlertTriangle className="w-2.5 h-2.5" /> Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-500/10 text-slate-500 border border-slate-500/20 w-fit">
        <Clock className="w-2.5 h-2.5" /> Pending
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="My Team"
          description="View direct reports, manage team members, and invite new employees directly into your team."
        />
        <Button
          onClick={() => setInviteDialogOpen(true)}
          className="h-9 rounded-xl text-xs font-semibold gap-1.5 shadow-sm shrink-0"
        >
          <UserPlus className="w-4 h-4" /> Invite Employee
        </Button>
      </div>

      {/* Tabs */}
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as 'members' | 'invitations')}
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or employee ID..."
            className="pl-9 h-9 text-xs rounded-xl"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={handleStatusChange}
            className="h-9 rounded-xl border border-input bg-card px-3 text-xs font-medium focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="invited">Invited (Pending)</option>
            <option value="suspended">Suspended</option>
          </select>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="h-9 px-2 text-xs gap-1 rounded-xl text-muted-foreground hover:text-foreground"
            title="Reset filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === 'members') refetchMembers();
              else refetchInvitations();
            }}
            disabled={
              activeTab === 'members'
                ? isMembersLoading || isMembersFetching
                : isInvitationsLoading || isInvitationsFetching
            }
            className="h-9 px-3 text-xs gap-1.5 rounded-xl border-border/70 hover:bg-muted/60"
            title="Refresh list"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                (activeTab === 'members' ? isMembersFetching : isInvitationsFetching)
                  ? 'animate-spin text-primary'
                  : ''
              }`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Tab 1: Team Members */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {isMembersLoading ? (
            <Skeletons count={5} />
          ) : isMembersError ? (
            <ErrorState
              title="Could not load team members"
              message="Failed to retrieve team members. Please check connection and try again."
              onRetry={refetchMembers}
            />
          ) : filteredMembers.length === 0 ? (
            <EmptyState
              title="No team members found"
              description={
                search || statusFilter
                  ? 'Try adjusting your search query or status filter.'
                  : 'You currently have no direct reports. Click "Invite Employee" to onboard someone into your team.'
              }
            />
          ) : (
            <div className="border border-border/70 rounded-2xl bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left table-fixed min-w-[900px] border-collapse">
                  <colgroup>
                    <col className="w-[240px]" />
                    <col className="w-[120px]" />
                    <col className="w-[180px]" />
                    <col className="w-[180px]" />
                    <col className="w-[180px]" />
                  </colgroup>
                  <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase tracking-wider font-bold text-[11px] h-11">
                    <tr>
                      <th className="py-3 px-4 font-bold align-middle">Member</th>
                      <th className="py-3 px-4 font-bold align-middle">Employee ID</th>
                      <th className="py-3 px-4 font-bold align-middle">Dept / Designation</th>
                      <th className="py-3 px-4 font-bold align-middle">Status & Delivery</th>
                      <th className="py-3 px-4 font-bold align-middle text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredMembers.map((m) => {
                      const memberId = m.id || m._id || '';
                      const isInvited = m.accountStatus === 'invited';
                      const invSummary = m.invitationSummary;
                      const invitationId = invSummary?.id;
                      const cooldown = invitationId ? cooldowns[invitationId] || 0 : 0;
                      const isResending = invitationId ? resendingId === invitationId : false;
                      const isChecking = invitationId ? checkingDeliveryId === invitationId : false;

                      return (
                        <tr key={memberId} className="hover:bg-muted/30 transition-colors h-14">
                          <td className="py-2.5 px-4 align-middle">
                            <EmployeeCell employee={m} />
                          </td>
                          <td className="py-2.5 px-4 align-middle text-muted-foreground font-mono">
                            {m.employeeId || '—'}
                          </td>
                          <td className="py-2.5 px-4 align-middle text-muted-foreground">
                            {m.department || m.designation ? (
                              <div>
                                <div className="font-medium text-foreground truncate max-w-[160px]">
                                  {m.designation || 'Employee'}
                                </div>
                                <div className="text-[11px] truncate max-w-[160px]">
                                  {m.department || 'General'}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 align-middle">
                            <div className="space-y-1">
                              {renderAccountStatusBadge(m.accountStatus, m.statusLabel)}
                              {isInvited && invSummary && (
                                <div className="pt-0.5">
                                  {renderDeliveryBadge(
                                    invSummary.emailDeliveryStatus,
                                    invSummary.emailLastEvent
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 align-middle text-right">
                            {isInvited && invitationId ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isResending || cooldown > 0}
                                  onClick={() => handleResend(invitationId, m.email)}
                                  className="h-8 px-2.5 rounded-xl text-xs gap-1 border-border/70 hover:bg-muted/60"
                                  title={
                                    cooldown > 0
                                      ? `Please wait ${cooldown}s before resending`
                                      : 'Resend invitation email'
                                  }
                                >
                                  {isResending ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Send className="w-3 h-3" />
                                  )}
                                  <span>{cooldown > 0 ? `${cooldown}s` : 'Resend'}</span>
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={isChecking}
                                  onClick={() => handleCheckDelivery(invitationId, m.email)}
                                  className="h-8 px-2 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                                  title="Check delivery status with provider"
                                >
                                  <Activity
                                    className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-primary' : ''}`}
                                  />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={isRevoking}
                                  onClick={() => handleRevoke(invitationId, m.email)}
                                  className="h-8 px-2 rounded-xl text-xs text-destructive hover:bg-destructive/10"
                                  title="Revoke invitation"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/60 italic pr-2">
                                Direct report
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Invitations & Delivery */}
      {activeTab === 'invitations' && (
        <div className="space-y-4">
          {isInvitationsLoading ? (
            <Skeletons count={5} />
          ) : isInvitationsError ? (
            <ErrorState
              title="Could not load invitations"
              message="Failed to retrieve team invitations log."
              onRetry={refetchInvitations}
            />
          ) : invitations.length === 0 ? (
            <EmptyState
              title="No invitations found"
              description="No team invitation records match the current criteria."
            />
          ) : (
            <div className="border border-border/70 rounded-2xl bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left table-fixed min-w-[900px] border-collapse">
                  <colgroup>
                    <col className="w-[220px]" />
                    <col className="w-[120px]" />
                    <col className="w-[130px]" />
                    <col className="w-[170px]" />
                    <col className="w-[140px]" />
                    <col className="w-[120px]" />
                  </colgroup>
                  <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase tracking-wider font-bold text-[11px] h-11">
                    <tr>
                      <th className="py-3 px-4 font-bold align-middle">Recipient</th>
                      <th className="py-3 px-4 font-bold align-middle">Status</th>
                      <th className="py-3 px-4 font-bold align-middle">Delivery</th>
                      <th className="py-3 px-4 font-bold align-middle">Provider Event</th>
                      <th className="py-3 px-4 font-bold align-middle">Last Sent</th>
                      <th className="py-3 px-4 font-bold align-middle text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {invitations.map((inv) => {
                      const invId = inv.id || inv._id || '';
                      const cooldown = cooldowns[invId] || 0;
                      const isResending = resendingId === invId;
                      const isChecking = checkingDeliveryId === invId;
                      const canResend = inv.status === 'pending' || inv.status === 'expired';
                      const canRevoke = inv.status === 'pending';
                      const eventInfo = inv.emailLastEvent ? formatLastEvent(inv.emailLastEvent) : null;

                      return (
                        <tr key={invId} className="hover:bg-muted/30 transition-colors h-14">
                          <td className="py-2.5 px-4 align-middle">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">{inv.name}</span>
                              <span className="text-[11px] text-muted-foreground font-mono">{inv.email}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 align-middle">{renderInvitationStatusBadge(inv.status)}</td>
                          <td className="py-2.5 px-4 align-middle">
                            {renderDeliveryBadge(inv.emailDeliveryStatus, null)}
                          </td>
                          <td className="py-2.5 px-4 align-middle text-muted-foreground">
                            {eventInfo ? (
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                <span className="font-medium text-foreground">{eventInfo.label}</span>
                              </div>
                            ) : inv.emailLastError ? (
                              <span className="text-rose-500 text-[11px] truncate max-w-[150px] block" title={inv.emailLastError.message}>
                                {inv.emailLastError.message}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 align-middle text-muted-foreground text-[11px]">
                            {inv.lastSentAt ? new Date(inv.lastSentAt).toLocaleString() : '—'}
                            {inv.resendCount && inv.resendCount > 0 ? (
                              <span className="block text-[10px] text-muted-foreground/70">
                                ({inv.resendCount} resend{inv.resendCount > 1 ? 's' : ''})
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2.5 px-4 align-middle text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {canResend && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isResending || cooldown > 0}
                                  onClick={() => handleResend(invId, inv.email)}
                                  className="h-8 px-2 rounded-xl text-xs gap-1 border-border/70"
                                  title="Resend invitation"
                                >
                                  {isResending ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Send className="w-3 h-3" />
                                  )}
                                  {cooldown > 0 ? `${cooldown}s` : 'Resend'}
                                </Button>
                              )}
                              {inv.emailProviderMessageId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={isChecking}
                                  onClick={() => handleCheckDelivery(invId, inv.email)}
                                  className="h-8 px-2 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                                  title="Check delivery status"
                                >
                                  <Activity
                                    className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-primary' : ''}`}
                                  />
                                </Button>
                              )}
                              {canRevoke && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={isRevoking}
                                  onClick={() => handleRevoke(invId, inv.email)}
                                  className="h-8 px-2 rounded-xl text-xs text-destructive hover:bg-destructive/10"
                                  title="Revoke invitation"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invite Team Member Dialog */}
      <InviteTeamMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={() => {
          refetchMembers();
          refetchInvitations();
        }}
      />
    </div>
  );
};
