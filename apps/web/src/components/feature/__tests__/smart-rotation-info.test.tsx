import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SmartRotationInfo } from '../smart-rotation-info';
import { smartRotation } from '@/lib/copy';

describe('SmartRotationInfo', () => {
  it('keeps the explainer closed until the trigger is used', () => {
    render(<SmartRotationInfo />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens an accessible dialog with every scoring rule', async () => {
    render(<SmartRotationInfo />);
    await userEvent.click(screen.getByRole('button', { name: smartRotation.title }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    for (const point of smartRotation.points) {
      expect(screen.getByText(point)).toBeTruthy();
    }
  });

  it('closes when dismissed', async () => {
    render(<SmartRotationInfo />);
    await userEvent.click(screen.getByRole('button', { name: smartRotation.title }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
