import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App component', () => {
  it('renders application title', () => {
    render(<App />);
    expect(screen.getByText(/Attendance Management System/i)).toBeInTheDocument();
  });
});
