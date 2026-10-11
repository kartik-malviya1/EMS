import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useValidateInvitationTokenMutation,
  useAcceptInvitationMutation,
  type ValidateInvitationResponse,
} from '../features/invitations/invitationsApi';
import { Button } from '../components/ui/button';
import { PasswordInput } from '../components/ui/password-input';
import { Label } from '../components/ui/label';
import { ThemeToggle } from '../components/layout/ThemeToggle';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Ban,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Lock,
  Mail,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';

const acceptPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(128, 'Password cannot exceed 128 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type AcceptPasswordFormValues = z.infer<typeof acceptPasswordSchema>;

export const AcceptInvitationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [validateToken, { isLoading: isValidating }] = useValidateInvitationTokenMutation();
  const [acceptInvitation, { isLoading: isSubmitting }] = useAcceptInvitationMutation();

  const [invitationData, setInvitationData] = useState<ValidateInvitationResponse | null>(null);
  const [validationErrorCode, setValidationErrorCode] = useState<string | null>(null);
  const [validationErrorMessage, setValidationErrorMessage] = useState<string | null>(null);
  const [hasActivated, setHasActivated] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AcceptPasswordFormValues>({
    resolver: zodResolver(acceptPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const enteredPassword = watch('password', '');

  // Protect against token leakage via referrer policy
  useEffect(() => {
    let metaTag = document.querySelector('meta[name="referrer"]') as HTMLMetaElement | null;
    const created = !metaTag;
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'referrer';
      document.head.appendChild(metaTag);
    }
    const previousContent = metaTag.content;
    metaTag.content = 'no-referrer';

    return () => {
      if (created && metaTag) {
        metaTag.remove();
      } else if (metaTag) {
        metaTag.content = previousContent || 'strict-origin-when-cross-origin';
      }
    };
  }, []);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setValidationErrorCode('TOKEN_MISSING');
      setValidationErrorMessage('No invitation token was provided in the link.');
      return;
    }

    const runValidation = async () => {
      try {
        const res = await validateToken({ token }).unwrap();
        setInvitationData(res);
        setValidationErrorCode(null);
        setValidationErrorMessage(null);
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

        const code = errorPayload?.data?.error?.code || 'VALIDATION_FAILED';
        const message =
          errorPayload?.data?.error?.message ||
          errorPayload?.error ||
          'Failed to validate invitation token. The link may be invalid or expired.';

        setValidationErrorCode(code);
        setValidationErrorMessage(message);
      }
    };

    runValidation();
  }, [token, validateToken]);

  const onSubmit = async (values: AcceptPasswordFormValues) => {
    if (!token) return;

    try {
      await acceptInvitation({
        token,
        password: values.password,
        confirmPassword: values.confirmPassword,
      }).unwrap();

      setHasActivated(true);
      toast.success('Account successfully activated! Please sign in with your new password.');
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

      const message =
        errorPayload?.data?.error?.message ||
        errorPayload?.error ||
        'Failed to activate account. Please try again.';
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 relative bg-background text-foreground transition-colors">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-xl p-8 sm:p-10 space-y-6">
        {/* Brand Header */}
        <div className="space-y-2 text-center">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2 shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Attendance Management Portal &bull; AMS
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Account Activation
          </h1>
        </div>

        {/* State 1: Validating Token */}
        {isValidating && (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-xs font-medium text-muted-foreground">
              Verifying your invitation token...
            </p>
          </div>
        )}

        {/* State 2: Successfully Activated */}
        {!isValidating && hasActivated && (
          <div className="space-y-5 text-center py-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Welcome aboard!</h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Your password has been securely stored and your account is now active. You may now sign in.
              </p>
            </div>
            <Button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full h-10.5 rounded-xl text-xs font-semibold gap-1.5 shadow-md shadow-primary/20"
            >
              <span>Continue to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* State 3: Validation Error / Expired / Revoked / Already Accepted */}
        {!isValidating && !hasActivated && validationErrorCode && (
          <div className="space-y-5 py-2">
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 space-y-3">
              <div className="flex items-center gap-2.5 text-destructive font-semibold text-xs">
                {validationErrorCode === 'TOKEN_EXPIRED' ? (
                  <Clock className="w-4 h-4 shrink-0" />
                ) : validationErrorCode === 'TOKEN_REVOKED' ? (
                  <Ban className="w-4 h-4 shrink-0" />
                ) : validationErrorCode === 'TOKEN_ALREADY_ACCEPTED' ? (
                  <UserCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {validationErrorCode === 'TOKEN_EXPIRED'
                    ? 'Invitation Expired'
                    : validationErrorCode === 'TOKEN_REVOKED'
                    ? 'Invitation Revoked'
                    : validationErrorCode === 'TOKEN_ALREADY_ACCEPTED'
                    ? 'Invitation Already Accepted'
                    : 'Invalid Invitation Link'}
                </span>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {validationErrorMessage}
              </p>

              {validationErrorCode === 'TOKEN_EXPIRED' && (
                <p className="text-[11px] text-muted-foreground/80 italic">
                  Invitations expire after 72 hours for security. Please request your administrator to resend a renewed invitation.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {validationErrorCode === 'TOKEN_ALREADY_ACCEPTED' ? (
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full h-10 rounded-xl text-xs font-semibold gap-1.5"
                >
                  Go to Sign In <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Link
                  to="/login"
                  className="text-center text-xs font-semibold text-primary hover:underline py-2"
                >
                  Return to Sign In
                </Link>
              )}
            </div>
          </div>
        )}

        {/* State 4: Valid Invitation — Form for Password Creation */}
        {!isValidating && !hasActivated && !validationErrorCode && invitationData && (
          <div className="space-y-5">
            {/* Invitee Metadata Card */}
            <div className="p-3.5 rounded-xl border border-border/70 bg-muted/20 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <Mail className="w-3.5 h-3.5 text-primary" />
                <span>{invitationData.email}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>
                  Name: <strong className="text-foreground">{invitationData.name}</strong>
                </span>
                <span className="capitalize px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold text-[10px]">
                  {invitationData.role}
                </span>
              </div>
              {invitationData.department && (
                <div className="text-[11px] text-muted-foreground">
                  Department: {invitationData.department}
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Please choose a secure password to complete your account onboarding.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold">
                  New Password
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                  <PasswordInput
                    id="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    className="pl-9 h-10 rounded-xl"
                    {...register('password')}
                  />
                </div>
                {errors.password && (
                  <p id="password-error" className="text-xs text-destructive mt-1 font-medium">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-semibold">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.confirmPassword)}
                    aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                    className="pl-9 h-10 rounded-xl"
                    {...register('confirmPassword')}
                  />
                </div>
                {errors.confirmPassword && (
                  <p id="confirm-password-error" className="text-xs text-destructive mt-1 font-medium">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Password Quality Helpers */}
              <div className="text-[11px] text-muted-foreground/80 space-y-1 pt-1">
                <div
                  className={`flex items-center gap-1.5 ${
                    enteredPassword.length >= 8 ? 'text-emerald-600 dark:text-emerald-400' : ''
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span>At least 8 characters</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    /[A-Z]/.test(enteredPassword) && /[a-z]/.test(enteredPassword) && /\d/.test(enteredPassword)
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : ''
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span>Contains uppercase, lowercase, and numbers</span>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl text-xs font-semibold shadow-md shadow-primary/20 mt-2 gap-1.5"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Activating Account...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Activate Account</span>
                  </>
                )}
              </Button>
            </form>

            <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border/60">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcceptInvitationPage;
