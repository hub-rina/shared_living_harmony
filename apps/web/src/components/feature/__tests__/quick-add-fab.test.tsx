import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  pathname: '/h/h1/tasks',
  can: { isAdmin: true, isActive: true },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
}));

vi.mock('@/lib/household-context', () => ({
  useHousehold: () => ({
    householdId: 'h1',
    refresh: vi.fn(),
    createRitual: vi.fn(),
  }),
}));

vi.mock('@/lib/use-can', () => ({
  useCan: () => state.can,
}));

vi.mock('../add-chore-form', () => ({
  AddChoreForm: () => <div data-testid="add-chore-form" />,
}));
vi.mock('../flag-mess-form', () => ({
  FlagMessForm: () => <div data-testid="flag-mess-form" />,
}));
vi.mock('../caretaker-chore-form', () => ({
  CaretakerChoreForm: () => <div data-testid="caretaker-chore-form" />,
}));
vi.mock('../ritual-create-form', () => ({
  RitualCreateForm: () => <div data-testid="ritual-create-form" />,
}));

import { QuickAddFab } from '../quick-add-fab';

beforeEach(() => {
  state.pathname = '/h/h1/tasks';
  state.can = { isAdmin: true, isActive: true };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('QuickAddFab', () => {
  it('hides on segments without create actions', () => {
    state.pathname = '/h/h1/house';
    render(<QuickAddFab />);
    expect(screen.queryByRole('button', { name: /add to your home/i })).toBeNull();
  });

  it('hides for inactive members even on a create segment', () => {
    state.can = { isAdmin: true, isActive: false };
    render(<QuickAddFab />);
    expect(screen.queryByRole('button', { name: /add to your home/i })).toBeNull();
  });

  it('offers chore, flag, and caretaker actions to an admin on the tasks page', async () => {
    render(<QuickAddFab />);
    await userEvent.click(screen.getByRole('button', { name: /add to your home/i }));
    expect(screen.getByRole('button', { name: /routine chore/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /flag a mess/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /common-area chore/i })).toBeTruthy();
  });

  it('hides the caretaker action from non-admins', async () => {
    state.can = { isAdmin: false, isActive: true };
    render(<QuickAddFab />);
    await userEvent.click(screen.getByRole('button', { name: /add to your home/i }));
    expect(screen.getByRole('button', { name: /routine chore/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /common-area chore/i })).toBeNull();
  });

  it('opens the chore form when its menu row is chosen', async () => {
    render(<QuickAddFab />);
    await userEvent.click(screen.getByRole('button', { name: /add to your home/i }));
    await userEvent.click(screen.getByRole('button', { name: /routine chore/i }));
    expect(screen.getByTestId('add-chore-form')).toBeTruthy();
  });

  it('skips the menu and opens the form directly when only one action exists', async () => {
    state.pathname = '/h/h1/rituals';
    render(<QuickAddFab />);
    await userEvent.click(screen.getByRole('button', { name: /add to your home/i }));
    expect(screen.getByTestId('ritual-create-form')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^propose a ritual$/i })).toBeNull();
  });
});
