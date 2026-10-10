import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Clock, AlertCircle } from 'lucide-react';
import {
  loginSchema,
  type LoginFormValues,
} from '../validators/auth.validator';
import { useLoginMutation } from '../features/auth/authApi';
import { useAppDispatch } from '../app/hooks';
import { setCredentials } from '../features/auth/authSlice';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ThemeToggle } from '../components/layout/ThemeToggle';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const [loginMutation, { isLoading }] = useLoginMutation();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      setServerError(null);
      const user = await loginMutation(values).unwrap();
      dispatch(setCredentials({ user }));
      const fromPath = location.state?.from?.pathname || '/';
      navigate(fromPath, { replace: true });
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
      const message =
        errorObj?.message ||
        (typeof errorPayload?.error === 'string' ? errorPayload.error : null) ||
        'Invalid email or password. Please try again.';

      setServerError(message);

      if (errorObj?.details && Array.isArray(errorObj.details)) {
        errorObj.details.forEach((d) => {
          if (d.path && (d.path === 'email' || d.path === 'password')) {
            setError(d.path as keyof LoginFormValues, {
              type: 'server',
              message: d.message,
            });
          }
        });
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 relative bg-background text-foreground transition-colors">
      {/* Theme Toggle Top Right */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Main Centered Login Card */}
      <div className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-xl p-8 sm:p-10 space-y-6">
        {/* Brand Header */}
        <div className="space-y-2 text-center">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2 shadow-xs">
            <Clock className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Attendance Management &bull; AMS Portal
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Sign in
          </h1>
          <p className="text-xs text-muted-foreground">
            Enter your work credentials to access your attendance portal
          </p>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div
            className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2.5 animate-in fade-in"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{serverError}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-foreground">
              Work Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              className="h-10.5 rounded-xl bg-background border-border/80 focus-visible:ring-primary/30"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1 font-medium">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold text-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-10.5 rounded-xl bg-background border-border/80 focus-visible:ring-primary/30"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-destructive mt-1 font-medium">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-11 rounded-xl text-sm font-semibold shadow-md shadow-primary/20 hover:shadow-primary/30 active:scale-[0.99] transition-all"
            disabled={isLoading}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>

        {/* Create Account Link */}
        <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border/60">
          Don&apos;t have an account?{' '}
          <Link
            to="/signup"
            className="font-semibold text-primary hover:underline transition-colors"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
