import React, { useState } from 'react';
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
import type { GeofenceSettings } from '../../types/models';
import {
  ShieldCheck,
  ShieldAlert,
  MapPin,
  ExternalLink,
  LocateFixed,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Geofence Configuration"
          description="Configure company office coordinates, geofence radius, and location accuracy limits"
        />
        <Skeletons count={3} />
      </div>
    );
  }

  if (isError || !settings) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Geofence Configuration"
          description="Configure company office coordinates, geofence radius, and location accuracy limits"
        />
        <ErrorState
          title="Could not load geofence settings"
          message="Failed to retrieve settings from server. Please retry."
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Geofence Configuration"
        description="Enforce office radius attendance punching, configure office coordinates, and set GPS accuracy limits"
      />
      <GeofenceSettingsForm
        key={`${settings.officeLatitude}-${settings.officeLongitude}-${settings.enabled}`}
        settings={settings}
      />
    </div>
  );
};
