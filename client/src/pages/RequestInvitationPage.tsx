import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, CheckCircle2, ArrowLeft, Clock } from 'lucide-react';
import { useRequestInvitationLinkMutation } from '../features/auth/authApi';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ThemeToggle } from '../components/layout/ThemeToggle';

export const RequestInvitationPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [requestLink, { isLoading }] = useRequestInvitationLinkMutation();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    try {
      await requestLink({ email: cleanEmail }).unwrap();
    } catch {
      // Even if network or rate limit, show the same generic state to prevent enumeration
    } finally {
      setSubmitted(true);
      setCooldown(60);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 relative bg-background text-foreground transition-colors">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-xl p-8 sm:p-10 space-y-6">
        <div className="space-y-2 text-center">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2 shadow-xs">
            <Mail className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            AMS Portal &bull; Self-Service Link Request
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Request Invitation Link
          </h1>
          <p className="text-xs text-muted-foreground">
            Invited to AMS Portal but haven't received your activation link? Enter your email below.
          </p>
        </div>

        {submitted ? (
          <div
            className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 text-xs space-y-3 animate-in fade-in"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-2.5 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>Link Request Submitted</span>
            </div>
            <p className="leading-relaxed">
              If a pending invitation exists for this email, a new invitation link has been sent.
              Check your inbox and spam folder; it can take a few minutes.
            </p>
            <div className="pt-2 border-t border-emerald-500/20 text-muted-foreground dark:text-emerald-300/80">
              Still nothing after a few minutes? Check spam, or ask your administrator.
            </div>
            {cooldown > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>You can request another link in {cooldown}s</span>
              </div>
            )}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="request-email" className="text-xs font-semibold text-foreground">
              Work Email Address
            </Label>
            <Input
              id="request-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              className="h-10.5 rounded-xl bg-background border-border/80 focus-visible:ring-primary/30"
            />
          </div>

          <Button
            id="request-link-submit-button"
            type="submit"
            className="w-full h-11 rounded-xl text-sm font-semibold shadow-md shadow-primary/20 hover:shadow-primary/30 active:scale-[0.99] transition-all cursor-pointer"
            disabled={isLoading || cooldown > 0 || !email.trim()}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                <span>Submitting Request...</span>
              </span>
            ) : cooldown > 0 ? (
              `Wait ${cooldown}s to Resubmit`
            ) : (
              'Send Me a New Link'
            )}
          </Button>
        </form>

        <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border/60">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RequestInvitationPage;
