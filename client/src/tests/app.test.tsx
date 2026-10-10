import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App component', () => {
  it('renders application title', async () => {
    render(<App />);
    expect(await screen.findByText(/AMS Portal/i)).toBeInTheDocument();
  });
});
