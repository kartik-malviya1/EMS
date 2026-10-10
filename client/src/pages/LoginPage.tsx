import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  Shield,
  UserCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  loginSchema,
  type LoginFormValues,
} from "../validators/auth.validator";
import { useLoginMutation } from "../features/auth/authApi";
import { useAppDispatch } from "../app/hooks";
import { setCredentials } from "../features/auth/authSlice";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ThemeToggle } from "../components/layout/ThemeToggle";

type PortalType = "employee" | "admin";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const [loginMutation, { isLoading }] = useLoginMutation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [selectedPortal, setSelectedPortal] = useState<PortalType>("employee");

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      setServerError(null);
      const user = await loginMutation(values).unwrap();
      dispatch(setCredentials({ user }));
      const fromPath = location.state?.from?.pathname || "/";
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

  const handleDemoFill = (email: string, pass: string, portal: PortalType) => {
    setSelectedPortal(portal);
    setValue("email", email, { shouldValidate: true });
    setValue("password", pass, { shouldValidate: true });
    setServerError(null);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 relative bg-background text-foreground">
      {/* Absolute Theme Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Left Column: Brand Hero Banner (matches user inspiration) */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white overflow-hidden">
        {/* Subtle dot-grid pattern inspired by tanX */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255, 255, 255, 0.4) 1.5px, transparent 1.5px)",
            backgroundSize: "24px 24px",
            maskImage:
              "radial-gradient(circle at center, black 0%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(circle at center, black 0%, transparent 80%)",
          }}
        />

        {/* Ambient glow accent */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Top Bar */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-extrabold text-xl shadow-lg shadow-indigo-500/30">
            E
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight">AMS Portal</span>
            <span className="block text-xs text-indigo-200/70 font-medium">
              Enterprise Workforce Management
            </span>
          </div>
        </div>

        {/* Hero Copy (matches user image) */}
        <div className="relative z-10 max-w-lg space-y-6 my-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
            <Sparkles className="w-3.5 h-3.5" /> Next-Gen Attendance
            Intelligence
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
            Employee <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-purple-200">
              Management System
            </span>
          </h1>

          <p className="text-base text-slate-300 leading-relaxed font-normal">
            Streamline your workforce operations, track attendance, manage
            payroll, and empower your team securely.
          </p>

          {/* Value Props */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-indigo-900/60">
            <div className="space-y-1">
              <span className="text-xl font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 100%
                Verified
              </span>
              <p className="text-xs text-slate-400">
                Selfie verification & geofenced punches
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xl font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Real-Time
              </span>
              <p className="text-xs text-slate-400">
                Live dashboard & instant overtime tracking
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Portal Selection & Login Form */}
      <div className="flex flex-col justify-between p-6 sm:p-12 lg:p-16 max-w-xl mx-auto w-full my-auto">
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Welcome Back
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              Select your portal to securely access the system.
            </p>
          </div>

          {/* Two Tabs Portal Selection: Admin Portal vs Employee Portal */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setSelectedPortal("admin")}
              className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all duration-300 group ${
                selectedPortal === "admin"
                  ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                  : "border-border/80 hover:border-primary/40 bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    selectedPortal === "admin"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  }`}
                >
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">
                    Admin Portal
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    System configuration, user management & reports
                  </p>
                </div>
              </div>
              <ArrowRight
                className={`w-4 h-4 transition-transform ${
                  selectedPortal === "admin"
                    ? "text-primary translate-x-1"
                    : "text-muted-foreground group-hover:translate-x-1"
                }`}
              />
            </button>

            <button
              type="button"
              onClick={() => setSelectedPortal("employee")}
              className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all duration-300 group ${
                selectedPortal === "employee"
                  ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                  : "border-border/80 hover:border-primary/40 bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    selectedPortal === "employee"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  }`}
                >
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">
                    Employee Portal
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Attendance punches, history & team shift reviews
                  </p>
                </div>
              </div>
              <ArrowRight
                className={`w-4 h-4 transition-transform ${
                  selectedPortal === "employee"
                    ? "text-primary translate-x-1"
                    : "text-muted-foreground group-hover:translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Quick Demo Credentials Prefills */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Quick Demo Login:
            </span>
            <div className="flex flex-wrap gap-2">
              {selectedPortal === "admin" ? (
                <button
                  type="button"
                  onClick={() =>
                    handleDemoFill(
                      "demo.admin@example.com",
                      "DemoPassword123",
                      "admin",
                    )
                  }
                  className="px-2.5 py-1 text-xs rounded-lg border border-border bg-background hover:border-primary/40 hover:bg-primary/5 font-medium transition-colors"
                >
                  ⚡ Demo Admin (demo.admin@example.com)
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      handleDemoFill(
                        "manager.sarah@example.com",
                        "DemoPassword123",
                        "employee",
                      )
                    }
                    className="px-2.5 py-1 text-xs rounded-lg border border-border bg-background hover:border-primary/40 hover:bg-primary/5 font-medium transition-colors"
                  >
                    ⚡ Demo Manager (manager.sarah)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleDemoFill(
                        "alice.walker@example.com",
                        "DemoPassword123",
                        "employee",
                      )
                    }
                    className="px-2.5 py-1 text-xs rounded-lg border border-border bg-background hover:border-primary/40 hover:bg-primary/5 font-medium transition-colors"
                  >
                    ⚡ Demo Employee (alice.walker)
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Server Error Alert */}
          {serverError && (
            <div
              className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2 animate-in fade-in"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-xs font-semibold">
                Work Email
              </Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  className="pl-9"
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="password" className="text-xs font-semibold">
                Password
              </Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9"
                  {...register("password")}
                />
              </div>
              {errors.password && (
                <p className="text-xs text-destructive mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-xl text-sm font-semibold shadow-md shadow-primary/20 hover:shadow-primary/30 active:scale-[0.99] transition-all"
              disabled={isLoading}
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          {/* Signup Link */}
          <div className="text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              to="/signup"
              className="font-semibold text-primary hover:underline"
            >
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
