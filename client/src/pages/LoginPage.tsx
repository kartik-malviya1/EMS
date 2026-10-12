import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clock, AlertCircle, ArrowRight, Shield, User } from "lucide-react";
import {
  loginSchema,
  type LoginFormValues,
} from "../validators/auth.validator";
import {
  useLoginMutation,
  useGetAuthConfigQuery,
} from "../features/auth/authApi";
import { getRoleDefaultPath } from "../routes/roleUtils";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { PasswordInput } from "../components/ui/password-input";
import { Label } from "../components/ui/label";
import { ThemeToggle } from "../components/layout/ThemeToggle";

type PortalType = "admin" | "employee";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedPortal, setSelectedPortal] = useState<PortalType>("employee");
  const [loginMutation, { isLoading }] = useLoginMutation();
  const { data: authConfig } = useGetAuthConfigQuery();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handlePortalSelect = (portal: PortalType) => {
    setSelectedPortal(portal);
    setServerError(null);
  };

  const fillDemoCredentials = (role: "admin" | "manager" | "employee") => {
    setServerError(null);
    if (role === "admin") {
      setSelectedPortal("admin");
      setValue("email", "admin@gmail.com", { shouldValidate: true });
      setValue("password", "DemoPassword@123", { shouldValidate: true });
    } else if (role === "manager") {
      setSelectedPortal("employee");
      setValue("email", "manager.sarah@gmail.com", { shouldValidate: true });
      setValue("password", "DemoPassword@123", { shouldValidate: true });
    } else {
      setSelectedPortal("employee");
      setValue("email", "alice@gmail.com", { shouldValidate: true });
      setValue("password", "DemoPassword@123", { shouldValidate: true });
    }
  };

  const onSubmit = async (values: LoginFormValues) => {
    try {
      setServerError(null);
      const user = await loginMutation(values).unwrap();
      const fromState = (
        location.state as {
          from?: { pathname?: string; search?: string; hash?: string } | string;
        }
      )?.from;
      let targetPath = "";
      if (
        typeof fromState === "string" &&
        fromState &&
        fromState !== "/login" &&
        fromState !== "/signup"
      ) {
        targetPath = fromState;
      } else if (
        typeof fromState === "object" &&
        fromState?.pathname &&
        fromState.pathname !== "/login" &&
        fromState.pathname !== "/signup"
      ) {
        targetPath = `${fromState.pathname}${fromState.search || ""}${fromState.hash || ""}`;
      } else {
        targetPath = getRoleDefaultPath(user.role);
      }
      navigate(targetPath, { replace: true });
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
        (typeof errorPayload?.error === "string" ? errorPayload.error : null) ||
        "Invalid email or password. Please try again.";

      setServerError(message);

      if (errorObj?.details && Array.isArray(errorObj.details)) {
        errorObj.details.forEach((d) => {
          if (d.path && (d.path === "email" || d.path === "password")) {
            setError(d.path as keyof LoginFormValues, {
              type: "server",
              message: d.message,
            });
          }
        });
      }
    }
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 md:grid-cols-2 bg-background text-foreground transition-colors">
      {/* Left Column: Dark Navy Brand Hero */}
      <div className="hidden md:flex flex-col justify-between p-10 lg:p-16 bg-[#161730] text-white relative overflow-hidden">
        {/* Subtle decorative radial light */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/15">
            <Clock className="w-5 h-5 text-indigo-300" />
          </div>
          <span className="text-sm font-bold uppercase tracking-wider text-slate-300">
            AMS Portal
          </span>
        </div>

        {/* Center Headline */}
        <div className="relative z-10 space-y-4 my-auto max-w-lg">
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
            Attendance<br />Management System
          </h1>
          <p className="text-slate-300/80 text-sm lg:text-base leading-relaxed">
            Streamline your workforce operations, track attendance in real time, manage overtime workflows, and empower your team securely.
          </p>
        </div>

        {/* Bottom Feature Pill */}
        <div className="relative z-10 flex items-center gap-4 text-xs text-slate-400">
          <span>Real-time Clock-in</span>
          <span>&bull;</span>
          <span>Selfie Verification</span>
          <span>&bull;</span>
          <span>Overtime Workflows</span>
        </div>
      </div>

      {/* Right Column: Portal Selection & Login Form */}
      <div className="flex flex-col justify-between p-6 sm:p-10 lg:p-16 relative bg-background">
        {/* Top bar with ThemeToggle */}
        <div className="flex items-center justify-between sm:justify-end">
          <div className="flex md:hidden items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Attendance Portal
            </span>
          </div>
          <ThemeToggle />
        </div>

        {/* Form Container */}
        <div className="w-full max-w-md mx-auto my-auto py-8 space-y-6">
          <div className="space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Welcome Back
            </h2>
            <p className="text-sm text-muted-foreground">
              Select your portal to securely access the system.
            </p>
          </div>

          {/* Portal Selection Cards (matching ems-gs.vercel.app/login UX) */}
          {/* <div className="space-y-3">
            <button
              type="button"
              id="admin-portal-button"
              onClick={() => handlePortalSelect("admin")}
              className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left group ${
                selectedPortal === "admin"
                  ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-xs"
                  : "border-border/80 bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                    selectedPortal === "admin"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Admin Portal
                  </div>
                  <div className="text-xs text-muted-foreground">
                    System configuration, reviews &amp; users
                  </div>
                </div>
              </div>
              <ArrowRight
                className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
                  selectedPortal === "admin"
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              />
            </button>

            <button
              type="button"
              id="employee-portal-button"
              onClick={() => handlePortalSelect("employee")}
              className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left group ${
                selectedPortal === "employee"
                  ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-xs"
                  : "border-border/80 bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                    selectedPortal === "employee"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Employee Portal
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Punch in/out, view records &amp; overtime
                  </div>
                </div>
              </div>
              <ArrowRight
                className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
                  selectedPortal === "employee"
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              />
            </button>
          </div> */}

          {/* Quick Demo Fill Helper */}
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="text-muted-foreground">Demo logins:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="demo-admin-btn"
                onClick={() => fillDemoCredentials("admin")}
                className="font-medium text-primary hover:underline cursor-pointer"
              >
                Admin
              </button>
              <span className="text-muted-foreground">&bull;</span>
              <button
                type="button"
                id="demo-manager-btn"
                onClick={() => fillDemoCredentials("manager")}
                className="font-medium text-primary hover:underline cursor-pointer"
              >
                Manager
              </button>
              <span className="text-muted-foreground">&bull;</span>
              <button
                type="button"
                id="demo-employee-btn"
                onClick={() => fillDemoCredentials("employee")}
                className="font-medium text-primary hover:underline cursor-pointer"
              >
                Employee
              </button>
            </div>
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
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-semibold text-foreground"
              >
                Work Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={
                  selectedPortal === "admin"
                    ? "admin@company.com"
                    : "employee@company.com"
                }
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                className="h-10.5 rounded-xl bg-background border-border/80 focus-visible:ring-primary/30"
                {...register("email")}
              />
              {errors.email && (
                <p
                  id="email-error"
                  className="text-xs text-destructive mt-1 font-medium"
                >
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs font-semibold text-foreground"
              >
                Password
              </Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                className="h-10.5 rounded-xl bg-background border-border/80 focus-visible:ring-primary/30"
                {...register("password")}
              />
              {errors.password && (
                <p
                  id="password-error"
                  className="text-xs text-destructive mt-1 font-medium"
                >
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              id="login-submit-button"
              type="submit"
              className="w-full h-11 rounded-xl text-sm font-semibold shadow-md shadow-primary/20 hover:shadow-primary/30 active:scale-[0.99] transition-all cursor-pointer"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  <span>Signing In...</span>
                </span>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* Footer Links */}
          <div className="space-y-2 text-center text-xs text-muted-foreground pt-4 border-t border-border/60">
            {/* {authConfig?.publicRegistrationEnabled && (
              <div>
                New here?
                <Link
                  to="/signup"
                  className="font-semibold text-primary hover:underline transition-colors"
                >
                  Create an account
                </Link>
              </div>
            )} */}
            <div>
              Invited but didn't get the email?{" "}
              <Link
                to="/request-invitation"
                className="font-semibold text-primary hover:underline transition-colors"
              >
                Request a new link
              </Link>
            </div>
          </div>
        </div>

        {/* Footer Copyright */}
        <div className="text-center text-xs text-muted-foreground pt-4">
          &copy; 2026 Attendance Management System. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
