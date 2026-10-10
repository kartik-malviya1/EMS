import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../components/common/StatusBadge';

describe('StatusBadge Component', () => {
  describe('Working Status', () => {
    it('renders "In Progress" with amber styling for in_progress', () => {
      render(<StatusBadge type="working" status="in_progress" />);
      const badge = screen.getByTestId('badge-working-in_progress');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/In Progress/i);
    });

    it('renders "Completed" with emerald styling for completed', () => {
      render(<StatusBadge type="working" status="completed" />);
      const badge = screen.getByTestId('badge-working-completed');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/Completed/i);
    });

    it('renders "Incomplete" with orange styling for incomplete', () => {
      render(<StatusBadge type="working" status="incomplete" />);
      const badge = screen.getByTestId('badge-working-incomplete');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/Incomplete/i);
    });

    it('renders "Missed Shift" with rose styling for missed', () => {
      render(<StatusBadge type="working" status="missed" />);
      const badge = screen.getByTestId('badge-working-missed');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/Missed Shift/i);
    });
  });

  describe('Verification Status', () => {
    it('renders "Pending Review" for pending', () => {
      render(<StatusBadge type="verification" status="pending" />);
      const badge = screen.getByTestId('badge-verification-pending');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/Pending Review/i);
    });

    it('renders "Valid" with checkmark icon for valid', () => {
      render(<StatusBadge type="verification" status="valid" />);
      const badge = screen.getByTestId('badge-verification-valid');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/Valid/i);
    });

    it('renders "Invalid" with alert icon for invalid', () => {
      render(<StatusBadge type="verification" status="invalid" />);
      const badge = screen.getByTestId('badge-verification-invalid');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/Invalid/i);
    });
  });

  describe('Overtime Status', () => {
    it('renders "None" for none', () => {
      render(<StatusBadge type="overtime" status="none" />);
      const badge = screen.getByTestId('badge-overtime-none');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/None/i);
    });

    it('renders "OT Pending" for pending', () => {
      render(<StatusBadge type="overtime" status="pending" />);
      const badge = screen.getByTestId('badge-overtime-pending');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/OT Pending/i);
    });

    it('renders "OT Approved" for approved', () => {
      render(<StatusBadge type="overtime" status="approved" />);
      const badge = screen.getByTestId('badge-overtime-approved');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/OT Approved/i);
    });

    it('renders "OT Rejected" for rejected', () => {
      render(<StatusBadge type="overtime" status="rejected" />);
      const badge = screen.getByTestId('badge-overtime-rejected');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/OT Rejected/i);
    });
  });
});
