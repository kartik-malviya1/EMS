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
  Users,
} from 'lucide-react';
import {
  useCreateTeamInvitationMutation,
  type CreateInvitationResponse,
} from '../../features/invitations/invitationsApi';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../lib/utils';

interface InviteTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const InviteTeamMemberDialog: React.FC<InviteTeamMemberDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [createdResult, setCreatedResult] = useState<CreateInvitationResponse | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const [createTeamInvitation, { isLoading }] = useCreateTeamInvitationMutation();

  const resetForm = () => {
    setName('');
    setEmail('');
    setEmployeeId('');
    setDepartment('');
    setDesignation('');
    setDateOfJoining('');
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
      const result = await createTeamInvitation({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        employeeId: employeeId.trim() || undefined,
        department: department.trim() || undefined,
        designation: designation.trim() || undefined,
        dateOfJoining: dateOfJoining || null,
      }).unwrap();

      setCreatedResult(result);
      toast.success(`Invitation created for ${result.user?.name || result.invitation.email}`);
      onSuccess?.();
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Failed to issue team invitation. Please verify the input.');
      setErrorMessage(message);
    }
  };

  const handleCopyMessageId = async () => {
    const id = createdResult?.email?.providerMessageId;
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setHasCopied(true);
      toast.success('Message ID copied to clipboard');
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Determine delivery state
  const emailStatus = createdResult?.email?.status || createdResult?.invitation?.emailDeliveryStatus;
  const emailError = createdResult?.email?.error || createdResult?.invitation?.emailLastError;
  const providerMessageId = createdResult?.email?.providerMessageId || createdResult?.invitation?.emailProviderMessageId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            {createdResult ? 'Invitation Issued' : 'Invite Team Member'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            {createdResult
              ? 'The employee account has been created with pending activation and assigned to your team.'
              : 'Invite a new employee directly into your team. They will establish their credentials upon accepting the invitation.'}
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
                <span className="font-semibold text-foreground">Employee</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned Team:</span>
                <span className="font-semibold text-primary">Your Team (Direct Report)</span>
              </div>
            </div>

            {/* Email Outcome States */}
            {emailStatus === 'accepted' && (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Email accepted by Resend for {createdResult.invitation.email}.</span>
                </div>
                <p className="text-[11px] text-muted-foreground pl-6">
                  Inbox delivery is confirmed only when the status shows Delivered.
                </p>
                {providerMessageId && (
                  <div className="flex items-center justify-between gap-2 pl-6 pt-1">
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded">
                      ID: {providerMessageId}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyMessageId}
                      className="h-7 text-xs gap-1"
                    >
                      {hasCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy ID
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {emailStatus === 'failed' && (
              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-2">
                <div className="flex items-center gap-2 text-destructive font-semibold text-xs">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>Email delivery failed</span>
                </div>
                <p className="text-[11px] text-destructive/80 pl-6">
                  {emailError?.message || 'Provider could not dispatch the invitation email.'}
                </p>
              </div>
            )}

            {(!emailStatus || emailStatus === 'pending') && (
              <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                  <Send className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <span>Invitation dispatched (Processing)</span>
                </div>
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button type="button" size="sm" onClick={handleClose} className="w-full">
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Auto-assignment callout */}
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs flex items-center gap-2.5 text-primary">
              <Users className="w-4 h-4 shrink-0" />
              <span>
                New member will be assigned to <strong>your team</strong> with role <strong>Employee</strong>.
              </span>
            </div>

            <div className="space-y-1">
              <Label htmlFor="team-invite-name" className="text-xs font-semibold">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="team-invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="team-invite-email" className="text-xs font-semibold">
                Work Email <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="team-invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane.doe@company.com"
                  required
                  className="h-9 text-xs pl-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="team-invite-employee-id" className="text-xs font-semibold">
                  Employee ID <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Input
                  id="team-invite-employee-id"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="EMP-012"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="team-invite-department" className="text-xs font-semibold">
                  Department <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Input
                  id="team-invite-department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Engineering"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="team-invite-designation" className="text-xs font-semibold">
                  Designation <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Input
                  id="team-invite-designation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="Frontend Developer"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="team-invite-joining" className="text-xs font-semibold">
                  Date of Joining <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Input
                  id="team-invite-joining"
                  type="date"
                  value={dateOfJoining}
                  onChange={(e) => setDateOfJoining(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="mt-5 flex flex-row items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isLoading}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isLoading} className="h-9 text-xs gap-1.5">
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Sending Invite...
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
