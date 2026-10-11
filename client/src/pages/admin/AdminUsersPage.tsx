import React, { useState, useTransition } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeletons } from '../../components/common/Skeletons';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { UserEditDialog } from '../../components/users/UserEditDialog';
import { InviteUserDialog } from '../../components/users/InviteUserDialog';
import { InvitationsTable } from '../../components/users/InvitationsTable';
import { EmployeeCell } from '../../components/common/EmployeeCell';
import { useGetUsersQuery } from '../../features/users/usersApi';
import { useGetEmailStatusQuery } from '../../features/invitations/invitationsApi';
import type { User, Role, AccountStatus } from '../../types/models';
import { TabNavigation, type TabItem } from '../../components/common/TabNavigation';
import {
  Search,
  UserCog,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RefreshCw,
  Shield,
  Briefcase,
  User as UserIcon,
  UserPlus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Mail,
} from 'lucide-react';

export const AdminUsersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'directory' | 'invitations'>('directory');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [accountStatus, setAccountStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const queryParams = {
    search: search.trim() || undefined,
    role: role || undefined,
    accountStatus: accountStatus || undefined,
    page,
    limit: 15,
  };

  const { data, isLoading, isError, isFetching, refetch } = useGetUsersQuery(queryParams);
  const { data: emailStatus } = useGetEmailStatusQuery();

  const handleResetFilters = () => {
    setSearch('');
    startTransition(() => {
      setRole('');
      setAccountStatus('');
      setPage(1);
    });
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as Role | '';
    startTransition(() => {
      setRole(val);
      setPage(1);
    });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    startTransition(() => {
      setAccountStatus(val);
      setPage(1);
    });
  };

  const handlePageChange = (newPage: number) => {
    startTransition(() => {
      setPage(newPage);
    });
  };

  const users = data?.data || [];
  const meta = data?.meta;

  const tabs: TabItem[] = [
    { id: 'directory', label: 'Staff Directory', count: meta?.total },
    { id: 'invitations', label: 'Invitations & Onboarding' },
  ];

  const renderRoleBadge = (userRole: Role) => {
    switch (userRole) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      case 'manager':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Briefcase className="w-3 h-3" /> Manager
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            <UserIcon className="w-3 h-3" /> Employee
          </span>
        );
    }
  };

  const renderAccountStatusBadge = (status?: AccountStatus, isActive?: boolean) => {
    const computedStatus = status || (isActive ? 'active' : 'deactivated');
    switch (computedStatus) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Active
          </span>
        );
      case 'invited':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Invited
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
            <AlertTriangle className="w-3 h-3" /> Suspended
          </span>
        );
      case 'deactivated':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" /> Deactivated
          </span>
        );
      default:
        return <span>{computedStatus}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Invite Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Staff Directory & Lifecycle"
          description="Manage employee accounts, organizational reporting lines, and invite-only onboarding."
        />
        <Button
          onClick={() => setInviteDialogOpen(true)}
          className="h-9 rounded-xl text-xs font-semibold gap-1.5 shadow-sm shrink-0"
        >
          <UserPlus className="w-4 h-4" /> Invite User
        </Button>
      </div>

      {/* Tabs Navigation */}
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as 'directory' | 'invitations')}
      />

      {/* Tab 1: Staff Directory */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search staff by name or email..."
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={role}
                onChange={handleRoleChange}
                className="h-9 rounded-xl border border-input bg-card px-3 text-xs font-medium focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Roles</option>
                <option value="employee">Employees</option>
                <option value="manager">Managers</option>
                <option value="admin">Administrators</option>
              </select>

              <select
                value={accountStatus}
                onChange={handleStatusChange}
                className="h-9 rounded-xl border border-input bg-card px-3 text-xs font-medium focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Account Statuses</option>
                <option value="active">Active Only</option>
                <option value="invited">Invited (Pending)</option>
                <option value="suspended">Suspended</option>
                <option value="deactivated">Deactivated</option>
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
                onClick={() => refetch()}
                disabled={isLoading || isFetching}
                className="h-9 px-3 text-xs gap-1.5 rounded-xl border-border/70 hover:bg-muted/60"
                title="Refresh staff"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-primary' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>

          {/* Users Table */}
          {isLoading ? (
            <Skeletons count={5} />
          ) : isError ? (
            <ErrorState
              title="Could not load users"
              message="Failed to retrieve user list. Please try again."
              onRetry={refetch}
            />
          ) : users.length === 0 ? (
            <EmptyState
              title="No users found"
              description="Try broadening your search query or reset the filters."
            />
          ) : (
            <section
              aria-busy={isPending}
              className={`space-y-4 transition-opacity duration-150 ${
                isPending ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              <div className="border border-border/70 rounded-2xl bg-card overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left table-fixed min-w-[940px] border-collapse">
                    <colgroup>
                      <col className="w-[240px]" />
                      <col className="w-[120px]" />
                      <col className="w-[170px]" />
                      <col className="w-[170px]" />
                      <col className="w-[130px]" />
                      <col className="w-[90px]" />
                    </colgroup>
                    <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase tracking-wider font-bold text-[11px] h-11">
                      <tr>
                        <th className="py-3 px-4 font-bold align-middle">User</th>
                        <th className="py-3 px-4 font-bold align-middle">Role</th>
                        <th className="py-3 px-4 font-bold align-middle">Dept / Designation</th>
                        <th className="py-3 px-4 font-bold align-middle">Reporting Manager</th>
                        <th className="py-3 px-4 font-bold align-middle">Status</th>
                        <th className="py-3 px-4 font-bold align-middle text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {users.map((u) => {
                        const manager =
                          typeof u.managerId === 'object' && u.managerId !== null
                            ? (u.managerId as User)
                            : null;
                        const uId = u.id || u._id;

                        return (
                          <tr key={uId} className="hover:bg-muted/30 transition-colors h-14">
                            <td className="py-2.5 px-4 align-middle">
                              <EmployeeCell employee={u} />
                            </td>
                            <td className="py-2.5 px-4 align-middle">{renderRoleBadge(u.role)}</td>
                            <td className="py-2.5 px-4 align-middle text-muted-foreground">
                              {u.department || u.designation ? (
                                <div>
                                  <div className="font-medium text-foreground truncate max-w-[150px]" title={u.designation || undefined}>
                                    {u.designation || 'Staff'}
                                  </div>
                                  <div className="text-[11px] truncate max-w-[150px]" title={u.department || undefined}>
                                    {u.department || 'General'}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 align-middle text-muted-foreground">
                              {u.role === 'employee' ? (
                                manager ? (
                                  <span className="font-medium text-foreground truncate block max-w-[150px]" title={manager.name}>
                                    {manager.name}
                                  </span>
                                ) : (
                                  <span className="italic text-muted-foreground/70">None assigned</span>
                                )
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 align-middle">{renderAccountStatusBadge(u.accountStatus, u.isActive)}</td>
                            <td className="py-2.5 px-4 align-middle text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 rounded-xl text-xs font-semibold hover:border-primary hover:text-primary transition-all gap-1.5"
                                onClick={() => {
                                  setSelectedUser(u);
                                  setEditDialogOpen(true);
                                }}
                              >
                                <UserCog className="w-3.5 h-3.5" /> Edit
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {meta && (
                  <div className="p-3 border-t border-border/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground bg-muted/20">
                    <span>
                      Showing Page <span className="font-semibold text-foreground">{meta.page}</span> of{' '}
                      <span className="font-semibold text-foreground">{meta.totalPages}</span> ({meta.total} users total)
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs rounded-xl gap-1 px-3"
                        disabled={meta.page <= 1}
                        onClick={() => handlePageChange(Math.max(1, meta.page - 1))}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs rounded-xl gap-1 px-3"
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
        </div>
      )}

      {/* Tab 2: Invitations & Onboarding */}
      {activeTab === 'invitations' && (
        <div className="space-y-4">
          {/* Email Status Banners */}
          {emailStatus && !emailStatus.configured && (
            <div className="p-3.5 rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-start gap-2.5">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Email is not configured</span>: Resend API key is missing or not configured. Invitation emails cannot be sent.
              </div>
            </div>
          )}

          {emailStatus?.configured && emailStatus.sandboxSender && (
            <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
              <Mail className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <span className="font-semibold">Sandbox sender:</span> only your own Resend account email can receive emails. Verify a domain to invite others.
              </div>
            </div>
          )}

          <InvitationsTable />
        </div>
      )}

      {/* Edit User Dialog */}
      <UserEditDialog
        user={selectedUser}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={refetch}
      />

      {/* Invite User Dialog */}
      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={refetch}
      />
    </div>
  );
};
