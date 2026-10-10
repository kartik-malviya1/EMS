import { describe, it, expect } from 'vitest';
import { loginSchema, signupSchema } from '../validators/auth.validator';

describe('Auth Validation Schemas', () => {
  describe('loginSchema', () => {
    it('validates correct email and alphanumeric password', () => {
      const valid = {
        email: 'alex@company.com',
        password: 'Password123',
      };
      const result = loginSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid email format', () => {
      const invalid = {
        email: 'not-an-email',
        password: 'Password123',
      };
      const result = loginSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('valid email');
      }
    });

    it('rejects passwords shorter than 8 characters', () => {
      const invalid = {
        email: 'alex@company.com',
        password: 'Pass1',
      };
      const result = loginSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 8 characters');
      }
    });

    it('rejects passwords lacking letters or digits', () => {
      const allLetters = {
        email: 'alex@company.com',
        password: 'PasswordOnlyLetters',
      };
      expect(loginSchema.safeParse(allLetters).success).toBe(false);

      const allDigits = {
        email: 'alex@company.com',
        password: '123456789012',
      };
      expect(loginSchema.safeParse(allDigits).success).toBe(false);
    });
  });

  describe('signupSchema', () => {
    it('validates matching password and confirmPassword', () => {
      const valid = {
        name: 'Alex Morgan',
        email: 'alex@company.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      };
      const result = signupSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects mismatched passwords', () => {
      const invalid = {
        name: 'Alex Morgan',
        email: 'alex@company.com',
        password: 'Password123',
        confirmPassword: 'Password456',
      };
      const result = signupSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Passwords do not match');
      }
    });
  });
});
