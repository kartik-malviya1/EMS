import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeletons } from '../../components/common/Skeletons';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { UserEditDialog } from '../../components/users/UserEditDialog';
import { useGetUsersQuery } from '../../features/users/usersApi';
import type { User, Role } from '../../types/models';
import {
  Search,
  UserCog,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Shield,
  Briefcase,
  User as UserIcon,
} from 'lucide-react';

export const AdminUsersPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [isActive, setIsActive] = useState<string>('');
  const [page, setPage] = useState(1);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const queryParams = {
    search: search.trim() || undefined,
    role: role || undefined,
    isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    page,
    limit: 15,
  };

  const { data, isLoading, isError, refetch } = useGetUsersQuery(queryParams);

  const handleResetFilters = () => {
    setSearch('');
    setRole('');
    setIsActive('');
    setPage(1);
  };

  const users = data?.data || [];
  const meta = data?.meta;

  const renderRoleBadge = (userRole: Role) => {
    switch (userRole) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      case 'manager':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Briefcase className="w-3 h-3" /> Manager
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            <UserIcon className="w-3 h-3" /> Employee
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Search, view, and modify roles, active status, and manager assignments across the company"
      />

      {/* Filter Bar */}
      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Search Name / Email
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter users..."
                  className="pl-8 h-9 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as Role | '');
                  setPage(1);
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">All Roles</option>
                <option value="employee">Employees</option>
                <option value="manager">Managers</option>
                <option value="admin">Administrators</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Account Status
              </label>
              <select
                value={isActive}
                onChange={(e) => {
                  setIsActive(e.target.value);
                  setPage(1);
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">All Statuses</option>
                <option value="true">Active Only</option>
                <option value="false">Inactive Only</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 w-full text-xs gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
          description="Try broadening your search query or reset the role filters."
        />
      ) : (
        <div className="space-y-4">
          <div className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border/70 text-muted-foreground uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Reporting Manager</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {users.map((u) => {
                    const manager =
                      typeof u.managerId === 'object' && u.managerId !== null
                        ? (u.managerId as User)
                        : null;
                    const uId = u.id || u._id;

                    return (
                      <tr
                        key={uId}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-4 font-semibold text-foreground">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                              {u.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <div>{u.name}</div>
                              <div className="text-[11px] font-normal text-muted-foreground">
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">{renderRoleBadge(u.role)}</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {u.role === 'employee' ? (
                            manager ? (
                              <span className="font-medium text-foreground">
                                {manager.name} ({manager.email})
                              </span>
                            ) : (
                              <span className="italic text-muted-foreground/70">
                                None assigned
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {u.isActive ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold text-xs">
                              <XCircle className="w-3.5 h-3.5" /> Deactivated
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-xs"
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
                  Page {meta.page} of {meta.totalPages} ({meta.total} users)
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
        </div>
      )}

      {/* Edit User Dialog */}
      <UserEditDialog
        user={selectedUser}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={refetch}
      />
    </div>
  );
};
