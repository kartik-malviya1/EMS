import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../models/user.model.js';
import { ROLES } from '../config/constants.js';
import { buildScopeFilter, canAccessEmployee } from '../services/scope.service.js';

describe('Scope Service', () => {
  let adminUser;
  let manager1;
  let manager2;
  let employee1UnderM1;
  let employee2InactiveUnderM1;
  let employee3UnderM2;

  beforeEach(async () => {
    adminUser = await User.create({
      name: 'Admin',
      email: 'admin@scope.com',
      passwordHash: 'dummy',
      role: ROLES.ADMIN,
    });

    manager1 = await User.create({
      name: 'Manager 1',
      email: 'm1@scope.com',
      passwordHash: 'dummy',
      role: ROLES.MANAGER,
    });

    manager2 = await User.create({
      name: 'Manager 2',
      email: 'm2@scope.com',
      passwordHash: 'dummy',
      role: ROLES.MANAGER,
    });

    employee1UnderM1 = await User.create({
      name: 'Emp 1 Active',
      email: 'e1@scope.com',
      passwordHash: 'dummy',
      role: ROLES.EMPLOYEE,
      managerId: manager1._id,
      isActive: true,
    });

    employee2InactiveUnderM1 = await User.create({
      name: 'Emp 2 Inactive',
      email: 'e2@scope.com',
      passwordHash: 'dummy',
      role: ROLES.EMPLOYEE,
      managerId: manager1._id,
      isActive: false, // inactive team members' history must stay visible
    });

    employee3UnderM2 = await User.create({
      name: 'Emp 3 Under M2',
      email: 'e3@scope.com',
      passwordHash: 'dummy',
      role: ROLES.EMPLOYEE,
      managerId: manager2._id,
      isActive: true,
    });
  });

  describe('buildScopeFilter', () => {
    it('returns empty filter {} for admin (system-wide access)', async () => {
      const filter = await buildScopeFilter(adminUser);
      expect(filter).toEqual({});
    });

    it('returns team members filter including inactive members for manager', async () => {
      const filter = await buildScopeFilter(manager1);
      expect(filter).toHaveProperty('employeeId');
      expect(filter.employeeId).toHaveProperty('$in');

      const ids = filter.employeeId.$in.map((id) => id.toString());
      expect(ids).toContain(employee1UnderM1._id.toString());
      expect(ids).toContain(employee2InactiveUnderM1._id.toString());
      expect(ids).not.toContain(employee3UnderM2._id.toString());
    });

    it('returns self-only filter for employee', async () => {
      const filter = await buildScopeFilter(employee1UnderM1);
      expect(filter).toEqual({ employeeId: employee1UnderM1._id });
    });
  });

  describe('canAccessEmployee', () => {
    it('allows admin to access any employee', async () => {
      expect(await canAccessEmployee(adminUser, employee1UnderM1._id)).toBe(true);
      expect(await canAccessEmployee(adminUser, employee3UnderM2._id)).toBe(true);
      expect(await canAccessEmployee(adminUser, manager1._id)).toBe(true);
    });

    it('allows manager to access self and own team members, but rejects other team members', async () => {
      expect(await canAccessEmployee(manager1, manager1._id)).toBe(true);
      expect(await canAccessEmployee(manager1, employee1UnderM1._id)).toBe(true);
      expect(await canAccessEmployee(manager1, employee2InactiveUnderM1._id)).toBe(true);

      // Other team member under manager2
      expect(await canAccessEmployee(manager1, employee3UnderM2._id)).toBe(false);
      // Other manager
      expect(await canAccessEmployee(manager1, manager2._id)).toBe(false);
    });

    it('allows employee to access only self and rejects other employees', async () => {
      expect(await canAccessEmployee(employee1UnderM1, employee1UnderM1._id)).toBe(true);
      expect(await canAccessEmployee(employee1UnderM1, employee2InactiveUnderM1._id)).toBe(false);
      expect(await canAccessEmployee(employee1UnderM1, manager1._id)).toBe(false);
      expect(await canAccessEmployee(employee1UnderM1, new mongoose.Types.ObjectId())).toBe(false);
    });
  });
});
