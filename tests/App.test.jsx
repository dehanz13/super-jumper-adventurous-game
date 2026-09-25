import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';

vi.mock('../src/pages/Game', () => ({
  default: () => <div>Game mounted</div>,
}));

describe('application shell', () => {
  it('mounts the game without a hosted-service login gate', () => {
    render(<App />);
    expect(screen.getByText('Game mounted')).toBeInTheDocument();
  });
});
