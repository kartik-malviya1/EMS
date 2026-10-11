import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { useSignupMutation, useGetAuthConfigQuery } from '../features/auth/authApi';
import { useAppDispatch } from '../app/hooks';
import { setCredentials } from '../features/auth/authSlice';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { PasswordInput } from '../components/ui/password-input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { ThemeToggle } from '../components/layout/ThemeToggle';

import { signupSchema, type SignupFormValues } from '../validators/auth.validator';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const { data: authConfig, isLoading: isConfigLoading } = useGetAuthConfigQuery();
  const [signupMutation, { isLoading }] = useSignupMutation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSignupDisabled, setIsSignupDisabled] = useState(false);

  // If token is present, forward to /accept-invitation
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      navigate(`/accept-invitation?token=${encodeURIComponent(token)}`, { replace: true });
    }
  }, [searchParams, navigate]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: SignupFormValues) => {
    try {
      setServerError(null);
      const user = await signupMutation({
        name: values.name,
        email: values.email,
        password: values.password,
      }).unwrap();
      dispatch(setCredentials({ user }));
      navigate('/employee', { replace: true });
    } catch (err: unknown) {
      const errorPayload = err as {
        status?: number | string;
        data?: {
          error?: {
            code?: string;
            message?: string;
            details?: Array<{ path?: string; message?: string }>;
          };
        };
        error?: string;
      };

      const errorObj = errorPayload?.data?.error;
      if (errorObj?.code === 'SIGNUP_DISABLED') {
        setIsSignupDisabled(true);
        setServerError('Registration is invitation-only');
        return;
      }

      const message =
        errorObj?.message ||
        (typeof errorPayload?.error === 'string' ? errorPayload.error : null) ||
        'Failed to create account. Please try again.';

      setServerError(message);

      if (errorObj?.details && Array.isArray(errorObj.details)) {
        errorObj.details.forEach((d) => {
          if (
            d.path &&
            (d.path === 'name' ||
              d.path === 'email' ||
              d.path === 'password' ||
              d.path === 'confirmPassword')
          ) {
            setError(d.path as keyof SignupFormValues, {
              type: 'server',
              message: d.message,
            });
          }
        });
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-muted/30">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black text-xl shadow-md mb-2">
            E
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Join the Attendance Management Portal &bull; EMS
          </p>
        </div>

        <Card className="border-border/80 shadow-md">
          {((!isConfigLoading && authConfig?.publicRegistrationEnabled === false) || isSignupDisabled) ? (
            <>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg font-bold">Registration is invitation-only</CardTitle>
                <CardDescription className="text-xs">
                  Public self-registration is currently disabled. New members must be invited by an organization administrator.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 text-center">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  If you have already received an invitation email, open the link provided in the message. If your link has expired or never arrived, request a fresh link below.
                </p>
                <Button
                  onClick={() => navigate('/request-invitation')}
                  className="w-full h-10.5 rounded-xl text-xs font-semibold gap-1.5 shadow-md shadow-primary/20"
                >
                  <span>Request Invitation Link</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </CardContent>
              <CardFooter className="justify-center border-t border-border/60 pt-4">
                <Link to="/login" className="text-xs font-semibold text-primary hover:underline">
                  Return to Sign In
                </Link>
              </CardFooter>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Sign Up</CardTitle>
                <CardDescription>
                  Enter your personal details to register
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <CardContent className="space-y-4">
              {serverError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 p-3 rounded-lg text-sm bg-destructive/10 text-destructive border border-destructive/20"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Alex Morgan"
                    className="pl-9"
                    autoComplete="name"
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? 'name-error' : undefined}
                    {...register('name')}
                  />
                </div>
                {errors.name && (
                  <p id="name-error" className="text-xs text-destructive mt-1 font-medium">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Work Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    className="pl-9"
                    autoComplete="email"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" className="text-xs text-destructive mt-1 font-medium">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                  <PasswordInput
                    id="password"
                    placeholder="••••••••"
                    className="pl-9"
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    {...register('password')}
                  />
                </div>
                {errors.password && (
                  <p id="password-error" className="text-xs text-destructive mt-1 font-medium">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="••••••••"
                    className="pl-9"
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.confirmPassword)}
                    aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                    {...register('confirmPassword')}
                  />
                </div>
                {errors.confirmPassword && (
                  <p id="confirm-password-error" className="text-xs text-destructive mt-1 font-medium">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full gap-2 cursor-pointer" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    <span>Creating Account...</span>
                  </span>
                ) : (
                  <>
                    <span>Sign Up</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="text-primary font-semibold hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </>
      )}
        </Card>
      </div>
    </div>
  );
};

export default SignupPage;
