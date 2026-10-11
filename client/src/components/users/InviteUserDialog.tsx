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
import {
  UserPlus,
  Mail,
  Check,
  Copy,
  AlertCircle,
  CheckCircle2,
  Send,
  Loader2,
  XCircle,
} from 'lucide-react';
import {
  useCreateInvitationMutation,
  type CreateInvitationResponse,
} from '../../features/invitations/invitationsApi';
import { useGetManagersQuery } from '../../features/users/usersApi';
import type { Role } from '../../types/models';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../lib/utils';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const InviteUserDialog: React.FC<InviteUserDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('employee');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [managerId, setManagerId] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [createdResult, setCreatedResult] = useState<CreateInvitationResponse | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const { data: managers = [] } = useGetManagersQuery();
  const [createInvitation, { isLoading }] = useCreateInvitationMutation();

  const resetForm = () => {
    setName('');
    setEmail('');
    setRole('employee');
    setEmployeeId('');
    setDepartment('');
    setDesignation('');
    setManagerId('');
    setErrorMessage(null);
    setCreatedResult(null);
    setHasCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !email.trim()) {
      setErrorMessage('Full name and email are required.');
      return;
    }

    try {
      const result = await createInvitation({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        employeeId: employeeId.trim() || undefined,
        department: department.trim() || undefined,
        designation: designation.trim() || undefined,
        managerId: role === 'employee' ? managerId || null : null,
      }).unwrap();

      setCreatedResult(result);
      toast.success(`Invitation created for ${result.user?.name || result.invitation.email}`);
      onSuccess?.();
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Failed to issue invitation. Please verify the input.');
      setErrorMessage(message);
    }
  };

  const handleCopyLink = async () => {
    const link = createdResult?.devInvitationLink || createdResult?.devInvitationUrl;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setHasCopied(true);
      toast.success('Invitation link copied to clipboard');
      setTimeout(() => setHasCopied(false), 2500);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Determine delivery state
  const emailStatus = createdResult?.email?.status || createdResult?.invitation?.emailDeliveryStatus;
  const emailMode = createdResult?.email?.mode || createdResult?.invitation?.emailMode;
  const emailError = createdResult?.email?.error || createdResult?.invitation?.emailLastError;
  const devLink = createdResult?.devInvitationLink;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            {createdResult ? 'Invitation Issued' : 'Invite User to Organization'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            {createdResult
              ? 'The employee account has been created with pending activation status.'
              : 'Issue a secure, one-time invitation link. Invited users establish their own password upon activation.'}
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-snug">{errorMessage}</p>
          </div>
        )}

        {createdResult ? (
          <div className="space-y-4 py-2">
            {/* Account Details Summary */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recipient Email:</span>
                <span className="font-semibold text-foreground">{createdResult.invitation.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned Role:</span>
                <span className="font-semibold text-foreground capitalize">{createdResult.invitation.role}</span>
              </div>
            </div>

            {/* Mutually Exclusive Email Outcome States */}
            {emailStatus === 'accepted' && (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Email sent to {createdResult.invitation.email}</span>
                </div>
                <p className="text-[11px] text-muted-foreground pl-6">
                  Accepted by Resend. Inbox delivery is not confirmed.
                </p>
                {createdResult.email?.providerMessageId && (
                  <p className="text-[10px] font-mono text-muted-foreground/70 pl-6">
                    ID: {createdResult.email.providerMessageId}
                  </p>
                )}
              </div>
            )}

            {emailStatus === 'failed' && (
              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-2">
                <div className="flex items-center gap-2 text-destructive font-semibold text-xs">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>Email failed</span>
                </div>
                <p className="text-[11px] text-destructive leading-relaxed pl-6">
                  {emailError?.message || 'Email delivery failed with provider error.'}
                </p>
                {emailError?.outcomeUnknown && (
                  <p className="text-[11px] text-muted-foreground pl-6">
                    It may still arrive; retry reuses the same request to avoid duplicates.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground pl-6">
                  You can retry sending this email from the Invitations &amp; Onboarding table.
                </p>
              </div>
            )}

            {emailStatus === 'dev_link' && devLink && emailMode === 'development' && (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5" /> Development mode — no email was sent
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    Dev Link
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Link shown once. Resending generates a new link.
                </p>

                <div className="flex items-center gap-2 mt-2">
                  <Input
                    readOnly
                    value={devLink}
                    className="font-mono text-[11px] h-8 bg-background"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCopyLink}
                    className="h-8 gap-1.5 shrink-0 text-xs"
                  >
                    {hasCopied ? (
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
            )}

            {emailStatus === 'pending' && (
              <div className="p-4 rounded-xl border border-border/70 bg-muted/20 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Processing invitation delivery...</span>
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button type="button" size="sm" onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="invite-name" className="text-xs font-semibold">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="invite-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="invite-email" className="text-xs font-semibold">
                  Work Email <span className="text-destructive">*</span>
                </Label>
                <div className="relative mt-1">
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@company.com"
                    required
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="invite-role" className="text-xs font-semibold">
                  Assigned Role <span className="text-destructive">*</span>
                </Label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => {
                    const nextRole = e.target.value as Role;
                    setRole(nextRole);
                    if (nextRole !== 'employee') setManagerId('');
                  }}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              <div>
                <Label htmlFor="invite-emp-id" className="text-xs font-semibold">
                  Employee ID (Optional)
                </Label>
                <Input
                  id="invite-emp-id"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. EMP-101"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="invite-department" className="text-xs font-semibold">
                  Department
                </Label>
                <Input
                  id="invite-department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Engineering"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="invite-designation" className="text-xs font-semibold">
                  Designation
                </Label>
                <Input
                  id="invite-designation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Frontend Specialist"
                  className="mt-1"
                />
              </div>
            </div>

            {role === 'employee' && (
              <div>
                <Label htmlFor="invite-manager" className="text-xs font-semibold">
                  Reporting Manager
                </Label>
                <select
                  id="invite-manager"
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">No Manager Assigned</option>
                  {managers.map((mgr) => {
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

            <DialogFooter className="mt-4 pt-2 flex flex-row items-center justify-end gap-2 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isLoading} className="gap-1.5 shadow-sm">
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Sending Invitation...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Send Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InviteUserDialog;
