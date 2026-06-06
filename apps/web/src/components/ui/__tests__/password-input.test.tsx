import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PasswordInput } from '../field';

describe('PasswordInput', () => {
  it('masks the value by default', () => {
    render(<PasswordInput aria-label="Password" defaultValue="secret" />);
    expect(screen.getByLabelText('Password').getAttribute('type')).toBe('password');
    expect(screen.getByRole('button', { name: /show password/i })).toBeTruthy();
  });

  it('reveals and re-hides the value when the eye is toggled', async () => {
    render(<PasswordInput aria-label="Password" defaultValue="secret" />);
    await userEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(screen.getByLabelText('Password').getAttribute('type')).toBe('text');
    await userEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(screen.getByLabelText('Password').getAttribute('type')).toBe('password');
  });
});
