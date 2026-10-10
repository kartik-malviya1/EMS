import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { User } from '../models/user.model.js';
import { ROLES } from '../config/constants.js';
import {
  calculateHaversineDistanceMeters,
  evaluateGeofence,
} from '../services/geofence.service.js';

describe('Geofencing & Settings', () => {
  let adminCookie;
  let employeeCookie;

  beforeEach(async () => {
    const passwordHash = await User.hashPassword('Password123');

    await User.create({
      name: 'Admin Geo',
      email: 'admin.geo@example.com',
      passwordHash,
      role: ROLES.ADMIN,
    });

    await User.create({
      name: 'Emp Geo',
      email: 'emp.geo@example.com',
      passwordHash,
      role: ROLES.EMPLOYEE,
    });

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin.geo@example.com',
      password: 'Password123',
    });
    adminCookie = adminLogin.headers['set-cookie'];

    const empLogin = await request(app).post('/api/auth/login').send({
      email: 'emp.geo@example.com',
      password: 'Password123',
    });
    employeeCookie = empLogin.headers['set-cookie'];
  });

  describe('Haversine Distance Calculation', () => {
    it('calculates 0 meters for identical coordinates', () => {
      const dist = calculateHaversineDistanceMeters(28.6139, 77.209, 28.6139, 77.209);
      expect(dist).toBe(0);
    });

    it('calculates reasonable distance between two known points', () => {
      // ~1.1 km between Connaught Place and India Gate approx
      const dist = calculateHaversineDistanceMeters(28.6315, 77.2167, 28.6129, 77.2295);
      expect(dist).toBeGreaterThan(1500);
      expect(dist).toBeLessThan(2500);
    });
  });

  describe('evaluateGeofence', () => {
    const officeSettings = {
      enabled: true,
      officeLatitude: 28.6139,
      officeLongitude: 77.209,
      radiusMeters: 200,
      maxAccuracyMeters: 100,
    };

    it('skips geofencing when disabled and returns null for distance and status', () => {
      const res = evaluateGeofence({
        latitude: 10.0,
        longitude: 10.0,
        accuracy: 50,
        settings: { ...officeSettings, enabled: false },
      });

      expect(res.distanceFromOfficeMeters).toBeNull();
      expect(res.withinGeofence).toBeNull();
    });

    it('succeeds when location is inside office radius and accuracy is acceptable', () => {
      const res = evaluateGeofence({
        latitude: 28.614,
        longitude: 77.2091,
        accuracy: 15,
        settings: officeSettings,
      });

      expect(res.withinGeofence).toBe(true);
      expect(res.distanceFromOfficeMeters).toBeLessThanOrEqual(200);
    });

    it('throws 422 OUTSIDE_GEOFENCE when distance exceeds radius', () => {
      expect(() =>
        evaluateGeofence({
          latitude: 28.63, // ~1.8 km away
          longitude: 77.22,
          accuracy: 15,
          settings: officeSettings,
        })
      ).toThrowError(
        expect.objectContaining({
          statusCode: 422,
          code: 'OUTSIDE_GEOFENCE',
        })
      );
    });

    it('throws 422 LOW_LOCATION_ACCURACY when accuracy > maxAccuracyMeters', () => {
      expect(() =>
        evaluateGeofence({
          latitude: 28.6139,
          longitude: 77.209,
          accuracy: 150, // exceeds max 100
          settings: officeSettings,
        })
      ).toThrowError(
        expect.objectContaining({
          statusCode: 422,
          code: 'LOW_LOCATION_ACCURACY',
        })
      );
    });
  });

  describe('Admin Settings Endpoints (GET & PUT /api/settings/geofence)', () => {
    it('forbids non-admin users from accessing settings endpoints', async () => {
      let res = await request(app)
        .get('/api/settings/geofence')
        .set('Cookie', employeeCookie);
      expect(res.status).toBe(403);

      res = await request(app)
        .put('/api/settings/geofence')
        .set('Cookie', employeeCookie)
        .send({ enabled: true });
      expect(res.status).toBe(403);
    });

    it('allows admin to get and update geofence settings with range validation', async () => {
      // 1. Get default settings
      let res = await request(app)
        .get('/api/settings/geofence')
        .set('Cookie', adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.key).toBe('geofence');

      // 2. Reject out of range coordinates
      res = await request(app)
        .put('/api/settings/geofence')
        .set('Cookie', adminCookie)
        .send({ officeLatitude: 95 }); // invalid > 90
      expect(res.status).toBe(400);

      // 3. Successfully update settings
      res = await request(app)
        .put('/api/settings/geofence')
        .set('Cookie', adminCookie)
        .send({
          enabled: true,
          officeLatitude: 28.5355,
          officeLongitude: 77.391,
          radiusMeters: 300,
          maxAccuracyMeters: 80,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.enabled).toBe(true);
      expect(res.body.data.radiusMeters).toBe(300);
      expect(res.body.data.maxAccuracyMeters).toBe(80);
    });
  });
});
