'use client';

import type { Household } from '@homebuddy/shared';

interface HouseholdPickerProps {
  households: Household[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function HouseholdPicker({ households, selectedId, onSelect }: HouseholdPickerProps) {
  if (households.length <= 1) return null;
  return (
    <nav
      aria-label="Choose household"
      className="-mx-1 flex gap-2 overflow-x-auto pb-1"
    >
      {households.map((h) => {
        const selected = h.id === selectedId;
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => onSelect(h.id)}
            aria-pressed={selected}
            className={`mx-1 shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors min-h-11 ${
              selected
                ? 'border-[var(--accent)] bg-[var(--accent)] text-cream'
                : 'border-[var(--border-strong)] hover:border-[var(--accent)] hover:bg-[var(--accent-wash)]'
            }`}
          >
            {h.name}
          </button>
        );
      })}
    </nav>
  );
}
