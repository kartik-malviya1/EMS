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
import {
  Search,
  UserCog,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Shield,
  Briefcase,
  User as UserIcon,
  UserPlus,
  Users,
  Mail,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
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

  const { data, isLoading, isError, refetch } = useGetUsersQuery(queryParams);
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

  const renderRoleBadge = (userRole: Role) => {
    switch (userRole) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      case 'manager':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Briefcase className="w-3 h-3" /> Manager
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
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

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'directory'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Staff Directory</span>
          {meta?.total !== undefined && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'directory'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {meta.total}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('invitations')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'invitations'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Invitations & Onboarding</span>
        </button>
      </div>

      {/* Tab 1: Staff Directory */}
      {activeTab === 'directory' && (
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
                className="h-9 text-xs gap-1 rounded-xl"
                title="Reset filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
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
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase tracking-wider font-bold text-[11px]">
                      <tr>
                        <th className="py-3.5 px-4">User</th>
                        <th className="py-3.5 px-4">Role</th>
                        <th className="py-3.5 px-4">Dept / Designation</th>
                        <th className="py-3.5 px-4">Reporting Manager</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Action</th>
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
                          <tr key={uId} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4">
                              <EmployeeCell employee={u} />
                            </td>
                            <td className="py-3 px-4">{renderRoleBadge(u.role)}</td>
                            <td className="py-3 px-4 text-muted-foreground">
                              {u.department || u.designation ? (
                                <div>
                                  <div className="font-medium text-foreground">{u.designation || 'Staff'}</div>
                                  <div className="text-[11px]">{u.department || 'General'}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground">
                              {u.role === 'employee' ? (
                                manager ? (
                                  <span className="font-medium text-foreground">{manager.name}</span>
                                ) : (
                                  <span className="italic text-muted-foreground/70">None assigned</span>
                                )
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4">{renderAccountStatusBadge(u.accountStatus, u.isActive)}</td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-xl text-xs font-semibold hover:border-primary hover:text-primary transition-all gap-1.5"
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

                {meta && meta.totalPages > 1 && (
                  <div className="p-3 border-t border-border/70 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
                    <span>
                      Showing Page {meta.page} of {meta.totalPages} ({meta.total} users total)
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
