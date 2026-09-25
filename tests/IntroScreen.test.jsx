import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import IntroScreen from '../src/components/IntroScreen';

describe('intro screen', () => {
  it.each([0, 1, 2, 3, 4])('renders animation phase %i and allows skipping', (phase) => {
    const onSkip = vi.fn();
    render(<IntroScreen introPhase={phase} onSkip={onSkip} />);

    fireEvent.click(screen.getByText(/skip/i));
    expect(onSkip).toHaveBeenCalledOnce();
  });
});
