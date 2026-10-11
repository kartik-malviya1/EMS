import React, { useState, useEffect, useRef } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeletons } from '../../components/common/Skeletons';
import { ErrorState } from '../../components/common/ErrorState';
import {
  useGetGeofenceSettingsQuery,
  useUpdateGeofenceSettingsMutation,
} from '../../features/settings/settingsApi';
import {
  useGetEmailStatusQuery,
  useSendAdminTestEmailMutation,
  useLazyGetMessageStatusQuery,
} from '../../features/invitations/invitationsApi';
import { useAppSelector } from '../../app/hooks';
import { formatLastEvent } from '../../lib/formatLastEvent';
import type { GeofenceSettings } from '../../types/models';
import {
  ShieldCheck,
  ShieldAlert,
  MapPin,
  ExternalLink,
  LocateFixed,
  Save,
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../lib/utils';

export const EmailDeliveryCard: React.FC = () => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const { data: emailStatus } = useGetEmailStatusQuery();
  const [sendTestEmail, { isLoading: isSendingTest }] = useSendAdminTestEmailMutation();
  const [fetchMessageStatus, { isFetching: isCheckingStatus }] = useLazyGetMessageStatusQuery();

  const [recipientInput, setRecipientInput] = useState<string | null>(null);
  const recipient = recipientInput !== null ? recipientInput : (currentUser?.email || '');

  // Result and Polling State
  const [testResult, setTestResult] = useState<{
    providerMessageId: string;
    acceptedAt: string;
  } | null>(null);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingCountdown, setPollingCountdown] = useState(60);
  const [hasCopiedId, setHasCopiedId] = useState(false);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling timers on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setIsPolling(false);
  };

  const checkStatusOnce = async (messageId: string) => {
    try {
      const data = await fetchMessageStatus(messageId).unwrap();
      if (data?.lastEvent) {
        setLastEvent(data.lastEvent);
        setLastEventAt(data.createdAt || new Date().toISOString());

        // Stop polling on terminal statuses
        const lower = data.lastEvent.toLowerCase();
        if (lower === 'delivered' || lower === 'bounced' || lower === 'complained') {
          stopPolling();
        }
      }
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'Failed to fetch message status.');
      // If permission failure or not found, stop polling and display
      setErrorMessage(msg);
      stopPolling();
    }
  };

  const startPolling = (messageId: string) => {
    stopPolling();
    setIsPolling(true);
    setPollingCountdown(60);

    // Initial check immediately
    checkStatusOnce(messageId);

    // Poll every 5s
    pollTimerRef.current = setInterval(() => {
      checkStatusOnce(messageId);
    }, 5000);

    // Countdown timer
    countdownTimerRef.current = setInterval(() => {
      setPollingCountdown((prev) => {
        if (prev <= 1) {
          stopPolling();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = recipient.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error('Please enter a recipient email address.');
      return;
    }

    setErrorMessage(null);
    setTestResult(null);
    setLastEvent(null);
    setLastEventAt(null);
    stopPolling();

    try {
      const res = await sendTestEmail({ to: cleanEmail }).unwrap();
      const messageId = res.email.providerMessageId;

      setTestResult({
        providerMessageId: messageId,
        acceptedAt: new Date().toLocaleTimeString(),
      });
      toast.success(`Test email accepted by Resend for ${cleanEmail}`);

      // Start live delivery tracking
      startPolling(messageId);
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'Failed to send test email.');
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  const handleCopyId = async () => {
    if (!testResult?.providerMessageId) return;
    try {
      await navigator.clipboard.writeText(testResult.providerMessageId);
      setHasCopiedId(true);
      toast.success('Message ID copied');
      setTimeout(() => setHasCopiedId(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const lastEventFormatted = formatLastEvent(lastEvent);

  return (
    <Card className="border-border/70 rounded-2xl shadow-xs">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" /> Email Delivery &amp; Verification
            </CardTitle>
            <CardDescription className="text-xs">
              Resend provider status, sender address verification, and live test delivery diagnostics
            </CardDescription>
          </div>
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              emailStatus?.configured
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
            }`}
          >
            {emailStatus?.configured ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" /> Configured
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5" /> Not Configured
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20 text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px]">Provider:</span>
            <span className="font-semibold text-foreground uppercase tracking-wide">
              {emailStatus?.provider || 'resend'}
            </span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-muted-foreground block text-[11px]">Outbound Sender:</span>
            <span className="font-mono text-foreground font-medium text-[11px] break-all">
              {emailStatus?.senderAddress || 'Not set'}
            </span>
          </div>
        </div>

        {/* Sandbox Warning Banner */}
        {emailStatus?.configured && emailStatus?.sandboxSender && (
          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div className="leading-relaxed">
              <span className="font-semibold">Sandbox sender active:</span> Resend's test sender can only deliver to your own Resend account email. Verify a domain at{' '}
              <a
                href="https://resend.com/domains"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold"
              >
                resend.com/domains
              </a>{' '}
              and set <code className="font-mono px-1 py-0.5 rounded bg-amber-500/20">EMAIL_FROM</code> to an address on it to email other people.
            </div>
          </div>
        )}

        {/* Not Configured Banner */}
        {emailStatus && !emailStatus.configured && (
          <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold">Email is not configured.</span> Outbound email delivery and test emails are disabled. Provide a valid <code className="font-mono px-1 py-0.5 rounded bg-destructive/20">RESEND_API_KEY</code> on the backend host to enable invitations.
            </div>
          </div>
        )}

        {/* Send Test Email Form */}
        <form onSubmit={handleSendTest} className="space-y-3 pt-2 border-t border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="test-email-recipient" className="text-xs font-semibold">
                Test Recipient Email
              </Label>
              <Input
                id="test-email-recipient"
                type="email"
                value={recipient}
                onChange={(e) => setRecipientInput(e.target.value)}
                placeholder="admin@company.com"
                required
                className="h-9.5 rounded-xl text-xs bg-background"
                disabled={isSendingTest}
              />
            </div>
            <Button
              type="submit"
              disabled={isSendingTest || !emailStatus?.configured || !recipient.trim()}
              className="h-9.5 text-xs font-semibold rounded-xl gap-1.5 shadow-sm shrink-0 cursor-pointer"
            >
              {isSendingTest ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching Test...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Email</span>
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Error message if dispatch or status check failed */}
        {errorMessage && (
          <div
            role="alert"
            aria-live="polite"
            className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2.5"
          >
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold">Delivery Error:</span> {errorMessage}
            </div>
          </div>
        )}

        {/* Live Result & Polling Panel */}
        {testResult && (
          <div
            role="status"
            aria-live="polite"
            className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" /> Accepted by Resend
                </span>
                <span className="text-[11px] text-muted-foreground">
                  at {testResult.acceptedAt}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => checkStatusOnce(testResult.providerMessageId)}
                  disabled={isCheckingStatus}
                  className="h-7 text-xs rounded-lg gap-1"
                >
                  {isCheckingStatus ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  <span>Check again</span>
                </Button>
              </div>
            </div>

            {/* Provider Message ID */}
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background border border-border/60 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-muted-foreground text-[11px] shrink-0">Message ID:</span>
                <span className="font-mono text-[11px] text-foreground truncate select-all">
                  {testResult.providerMessageId}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyId}
                className="h-6 text-[11px] gap-1 shrink-0 px-2"
              >
                {hasCopiedId ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Copy
                  </>
                )}
              </Button>
            </div>

            {/* Current Event / Status Display */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Delivery Event:</span>
                {lastEvent ? (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${lastEventFormatted.className}`}
                  >
                    <Activity className="w-3 h-3" /> {lastEventFormatted.label}
                    {lastEventAt && (
                      <span className="opacity-70 text-[10px]">
                        ({new Date(lastEventAt).toLocaleTimeString()})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">
                    {isPolling ? 'Awaiting event confirmation...' : 'No delivery event recorded yet.'}
                  </span>
                )}
              </div>

              {isPolling && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  <span>Polling ({pollingCountdown}s remaining)</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface GeofenceSettingsFormProps {
  settings: GeofenceSettings;
}

const GeofenceSettingsForm: React.FC<GeofenceSettingsFormProps> = ({
  settings,
}) => {
  const [updateGeofence, { isLoading: isUpdating }] =
    useUpdateGeofenceSettingsMutation();

  const [enabled, setEnabled] = useState(settings.enabled ?? false);
  const [officeLatitude, setOfficeLatitude] = useState<number>(
    settings.officeLatitude ?? 28.6139
  );
  const [officeLongitude, setOfficeLongitude] = useState<number>(
    settings.officeLongitude ?? 77.209
  );
  const [radiusMeters, setRadiusMeters] = useState<number>(
    settings.radiusMeters ?? 200
  );
  const [maxAccuracyMeters, setMaxAccuracyMeters] = useState<number>(
    settings.maxAccuracyMeters ?? 100
  );
  const [isLocating, setIsLocating] = useState(false);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOfficeLatitude(position.coords.latitude);
        setOfficeLongitude(position.coords.longitude);
        setIsLocating(false);
        toast.success(
          `Coordinates captured: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)} (accuracy: ±${Math.round(position.coords.accuracy)}m)`
        );
      },
      (error) => {
        setIsLocating(false);
        toast.error(`Unable to retrieve GPS position: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (officeLatitude < -90 || officeLatitude > 90) {
      toast.error('Latitude must be between -90 and 90');
      return;
    }
    if (officeLongitude < -180 || officeLongitude > 180) {
      toast.error('Longitude must be between -180 and 180');
      return;
    }
    if (radiusMeters <= 0) {
      toast.error('Radius must be greater than 0 meters');
      return;
    }
    if (maxAccuracyMeters <= 0) {
      toast.error('Max accuracy must be greater than 0 meters');
      return;
    }

    try {
      await updateGeofence({
        enabled,
        officeLatitude: Number(officeLatitude),
        officeLongitude: Number(officeLongitude),
        radiusMeters: Number(radiusMeters),
        maxAccuracyMeters: Number(maxAccuracyMeters),
      }).unwrap();

      toast.success('Geofence settings updated successfully');
    } catch (err: unknown) {
      const errorPayload = err as {
        data?: { error?: { message?: string } };
        error?: string;
      };
      toast.error(
        errorPayload?.data?.error?.message ||
          errorPayload?.error ||
          'Failed to update settings'
      );
    }
  };

  const mapsUrl = `https://www.google.com/maps?q=${officeLatitude},${officeLongitude}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Geofence Status Card */}
      <Card className="border-border/70 rounded-2xl shadow-xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">
                Geofence Enforcement Status
              </CardTitle>
              <CardDescription className="text-xs">
                When enabled, staff can only punch in or out if their device is within the office radius
              </CardDescription>
            </div>
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                enabled
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-muted text-muted-foreground border border-border'
              }`}
            >
              {enabled ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" /> Enforcement Active
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5" /> Enforcement Disabled
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-xl border border-border/80 bg-muted/20">
            <div className="space-y-0.5">
              <Label htmlFor="geofence-toggle" className="text-sm font-semibold cursor-pointer">
                Enable Geofence Validation
              </Label>
              <p className="text-xs text-muted-foreground">
                Reject punches when outside the permitted office radius or if location accuracy is poor
              </p>
            </div>
            <input
              type="checkbox"
              id="geofence-toggle"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-5 h-5 rounded-md text-primary focus:ring-primary/20 cursor-pointer accent-primary"
            />
          </div>
        </CardContent>
      </Card>

      {/* Office Location Coordinates Card */}
      <Card className="border-border/70 rounded-2xl shadow-xs">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Office Location Coordinates
          </CardTitle>
          <CardDescription className="text-xs">
            Latitude and longitude defining the center point of the primary office
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="office-lat" className="text-xs font-semibold">
                Office Latitude (-90 to 90)
              </Label>
              <Input
                id="office-lat"
                type="number"
                step="any"
                value={officeLatitude}
                onChange={(e) => setOfficeLatitude(parseFloat(e.target.value) || 0)}
                className="mt-1 rounded-xl text-xs"
                required
              />
            </div>

            <div>
              <Label htmlFor="office-lng" className="text-xs font-semibold">
                Office Longitude (-180 to 180)
              </Label>
              <Input
                id="office-lng"
                type="number"
                step="any"
                value={officeLongitude}
                onChange={(e) => setOfficeLongitude(parseFloat(e.target.value) || 0)}
                className="mt-1 rounded-xl text-xs"
                required
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="gap-1.5 text-xs rounded-xl"
            >
              <LocateFixed className="w-3.5 h-3.5 text-primary" />
              {isLocating ? 'Acquiring GPS...' : 'Use My Current Location'}
            </Button>

            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline border border-primary/20 px-3 py-1.5 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              Preview Office on Google Maps <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Boundary & Tolerance Limits Card */}
      <Card className="border-border/70 rounded-2xl shadow-xs">
        <CardHeader>
          <CardTitle className="text-base font-bold">
            Radius & Accuracy Thresholds
          </CardTitle>
          <CardDescription className="text-xs">
            Determine how far staff may be from the office coordinates and maximum tolerable GPS inaccuracy
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="radius-meters" className="text-xs font-semibold">
              Geofence Radius (Meters)
            </Label>
            <Input
              id="radius-meters"
              type="number"
              min={1}
              max={50000}
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(parseInt(e.target.value, 10) || 0)}
              className="mt-1 rounded-xl text-xs"
              required
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Standard default: 200 meters. Staff beyond this distance are rejected.
            </p>
          </div>

          <div>
            <Label htmlFor="max-accuracy" className="text-xs font-semibold">
              Maximum Location Accuracy (Meters)
            </Label>
            <Input
              id="max-accuracy"
              type="number"
              min={1}
              max={1000}
              value={maxAccuracyMeters}
              onChange={(e) => setMaxAccuracyMeters(parseInt(e.target.value, 10) || 0)}
              className="mt-1 rounded-xl text-xs"
              required
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Standard default: 100 meters. Rejects GPS reports with high uncertainty.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Changes Button */}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isUpdating}
          className="gap-2 px-6 h-10 rounded-xl font-bold shadow-xs"
        >
          <Save className="w-4 h-4" />
          {isUpdating ? 'Saving...' : 'Save Geofence Configuration'}
        </Button>
      </div>
    </form>
  );
};

export const AdminSettingsPage: React.FC = () => {
  const { data: settings, isLoading, isError, refetch } =
    useGetGeofenceSettingsQuery();

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="System & Organization Settings"
        description="Verify outbound email delivery via Resend, configure office geofence coordinates, and set location accuracy thresholds"
      />
      
      {/* Resend Email Delivery Card */}
      <EmailDeliveryCard />

      {/* Geofence Configuration */}
      {isLoading ? (
        <Skeletons count={2} />
      ) : isError || !settings ? (
        <ErrorState
          title="Could not load geofence settings"
          message="Failed to retrieve geofence settings from server. Please retry."
          onRetry={refetch}
        />
      ) : (
        <GeofenceSettingsForm
          key={`${settings.officeLatitude}-${settings.officeLongitude}-${settings.enabled}`}
          settings={settings}
        />
      )}
    </div>
  );
};
