import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { AlertCircle } from 'lucide-react';
import {
  useUpdateUserMutation,
  useGetManagersQuery,
} from '../../features/users/usersApi';
import type { User, Role } from '../../types/models';
import { toast } from 'sonner';

interface UserEditFormProps {
  user: User;
  onClose: () => void;
  onSuccess?: () => void;
}

const UserEditForm: React.FC<UserEditFormProps> = ({
  user,
  onClose,
  onSuccess,
}) => {
  const userId = user.id || user._id || '';
  const initialMgrId =
    typeof user.managerId === 'object' && user.managerId !== null
      ? (user.managerId as User).id || (user.managerId as User)._id || ''
      : (user.managerId as string) || '';

  const [name, setName] = useState(user.name || '');
  const [role, setRole] = useState<Role>(user.role || 'employee');
  const [employeeId, setEmployeeId] = useState(user.employeeId || '');
  const [department, setDepartment] = useState(user.department || '');
  const [designation, setDesignation] = useState(user.designation || '');
  const [accountStatus, setAccountStatus] = useState<string>(
    user.accountStatus || (user.isActive ? 'active' : 'deactivated')
  );
  const [managerId, setManagerId] = useState<string>(initialMgrId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: managers = [] } = useGetManagersQuery();
  const [updateUser, { isLoading }] = useUpdateUserMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      const payload: {
        id: string;
        name?: string;
        role?: Role;
        employeeId?: string;
        department?: string;
        designation?: string;
        accountStatus?: 'invited' | 'active' | 'suspended' | 'deactivated';
        managerId?: string | null;
        isActive?: boolean;
      } = {
        id: userId,
        name: name.trim() || undefined,
        employeeId: employeeId.trim() || undefined,
        department: department.trim() || undefined,
        designation: designation.trim() || undefined,
        accountStatus: accountStatus as 'invited' | 'active' | 'suspended' | 'deactivated',
        isActive: accountStatus === 'active',
      };

      if (user.role !== 'admin') {
        payload.role = role;
        if (role === 'employee') {
          payload.managerId = managerId || null;
        } else {
          payload.managerId = null;
        }
      }

      await updateUser(payload).unwrap();
      toast.success(`User "${name || user.email}" updated successfully`);
      onClose();
      onSuccess?.();
    } catch (err: unknown) {
      const errorPayload = err as {
        status?: number;
        data?: {
          error?: {
            code?: string;
            message?: string;
          };
        };
        error?: string;
      };

      const code = errorPayload?.data?.error?.code;
      const message = errorPayload?.data?.error?.message;

      if (code === 'HAS_TEAM_MEMBERS') {
        setErrorMessage(
          'Cannot demote or deactivate this manager because they have assigned team members. Please reassign their team members first.'
        );
      } else if (code === 'CANNOT_MODIFY_ADMIN_ROLE') {
        setErrorMessage(
          'Administrator roles cannot be granted or removed via the API.'
        );
      } else if (code === 'CANNOT_DEMOTE_LAST_ADMIN' || code === 'CANNOT_MODIFY_LAST_ADMIN') {
        setErrorMessage(
          'Cannot demote or deactivate the last active administrator in the system.'
        );
      } else {
        setErrorMessage(
          message || errorPayload?.error || 'Failed to update user'
        );
      }
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl font-bold">Edit User</DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground mt-0.5">
          Modify account role, manager assignment, or active status for{' '}
          <span className="font-semibold text-foreground">{user.email}</span>
        </DialogDescription>
      </DialogHeader>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="leading-snug">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        <div>
          <Label htmlFor="edit-name" className="text-xs font-semibold">
            Full Name
          </Label>
          <Input
            id="edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="edit-role" className="text-xs font-semibold">
            System Role
          </Label>
          {user.role === 'admin' ? (
            <div className="mt-1 px-3 py-2 rounded-md border border-input bg-muted/40 text-xs font-semibold text-muted-foreground">
              Administrator (Role cannot be modified via API)
            </div>
          ) : (
            <select
              id="edit-role"
              value={role}
              onChange={(e) => {
                const newRole = e.target.value as Role;
                setRole(newRole);
                if (newRole !== 'employee') {
                  setManagerId('');
                }
              }}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
            </select>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="edit-employee-id" className="text-xs font-semibold">
              Employee ID
            </Label>
            <Input
              id="edit-employee-id"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="e.g. EMP-101"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="edit-department" className="text-xs font-semibold">
              Department
            </Label>
            <Input
              id="edit-department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Engineering"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="edit-designation" className="text-xs font-semibold">
            Designation
          </Label>
          <Input
            id="edit-designation"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="e.g. Software Engineer"
            className="mt-1"
          />
        </div>

        {role === 'employee' && (
          <div>
            <Label htmlFor="edit-manager" className="text-xs font-semibold">
              Reporting Manager
            </Label>
            <select
              id="edit-manager"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">No Manager Assigned</option>
              {managers
                .filter((m) => (m.id || m._id) !== userId)
                .map((mgr) => {
                  const mgrId = mgr.id || mgr._id || '';
                  return (
                    <option key={mgrId} value={mgrId}>
                      {mgr.name} ({mgr.email})
                    </option>
                  );
                })}
            </select>
          </div>
        )}

        <div>
          <Label htmlFor="edit-account-status" className="text-xs font-semibold">
            Account Lifecycle Status
          </Label>
          <select
            id="edit-account-status"
            value={accountStatus}
            onChange={(e) => {
              setAccountStatus(e.target.value);
            }}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            {user.accountStatus === 'invited' && (
              <option value="invited">Invited (Awaiting Acceptance)</option>
            )}
            <option value="active">Active (Normal Access)</option>
            <option value="suspended">Suspended (Login Blocked, Records Retained)</option>
            <option value="deactivated">Deactivated (Account Closed)</option>
          </select>
          <p className="text-[11px] text-muted-foreground mt-1">
            Suspended and deactivated accounts cannot log in or record shifts. Historical attendance records are preserved.
          </p>
        </div>

        <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
};

interface UserEditDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const UserEditDialog: React.FC<UserEditDialogProps> = ({
  user,
  open,
  onOpenChange,
  onSuccess,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {user && (
          <UserEditForm
            key={user.id || user._id}
            user={user}
            onClose={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
