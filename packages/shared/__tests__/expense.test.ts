import {
  formatEuros,
  splitEqually,
  splitBill,
  netBalances,
  parseReceiptText,
  type ExpenseShareStatus,
} from '../src/expense';

describe('splitEqually', () => {
  test('splits evenly when divisible', () => {
    const result = splitEqually(3000, ['a', 'b', 'c']);
    expect(result).toEqual([
      { debtorId: 'a', amountCents: 1000 },
      { debtorId: 'b', amountCents: 1000 },
      { debtorId: 'c', amountCents: 1000 },
    ]);
  });

  test('spreads the remainder onto the first shares and still sums to the total', () => {
    const result = splitEqually(1000, ['a', 'b', 'c']);
    expect(result.map((s) => s.amountCents)).toEqual([334, 333, 333]);
    expect(result.reduce((acc, s) => acc + s.amountCents, 0)).toBe(1000);
  });

  test('single debtor takes the whole amount', () => {
    expect(splitEqually(4250, ['a'])).toEqual([{ debtorId: 'a', amountCents: 4250 }]);
  });

  test('no debtors yields no shares', () => {
    expect(splitEqually(4250, [])).toEqual([]);
  });
});

describe('splitBill', () => {
  test('splits among all sharers and drops the creator portion', () => {
    const shares = splitBill(4250, ['alice', 'bob'], 'alice');
    expect(shares).toEqual([{ debtorId: 'bob', amountCents: 2125 }]);
  });

  test('each debtor owes total/N, not total/(N-1)', () => {
    const shares = splitBill(3000, ['alice', 'bob', 'carol'], 'alice');
    expect(shares).toEqual([
      { debtorId: 'bob', amountCents: 1000 },
      { debtorId: 'carol', amountCents: 1000 },
    ]);
  });

  test('creator who is not among the sharers still owes nothing and is not added', () => {
    const shares = splitBill(1000, ['bob', 'carol'], 'alice');
    expect(shares.map((s) => s.debtorId)).toEqual(['bob', 'carol']);
    expect(shares.reduce((acc, s) => acc + s.amountCents, 0)).toBe(1000);
  });
});

describe('netBalances', () => {
  const share = (
    debtorId: string,
    debtorName: string,
    amountCents: number,
    status: ExpenseShareStatus = 'open',
  ) => ({ debtorId, debtorName, amountCents, status });

  test('counts what others owe the viewer as positive', () => {
    const balances = netBalances(
      [{ creatorId: 'alice', creatorName: 'Alice', shares: [share('bob', 'Bob', 2000)] }],
      'alice',
    );
    expect(balances).toEqual([{ userId: 'bob', name: 'Bob', netCents: 2000 }]);
  });

  test('counts what the viewer owes others as negative', () => {
    const balances = netBalances(
      [{ creatorId: 'alice', creatorName: 'Alice', shares: [share('bob', 'Bob', 800)] }],
      'bob',
    );
    expect(balances).toEqual([{ userId: 'alice', name: 'Alice', netCents: -800 }]);
  });

  test('nets directional debts across multiple bills', () => {
    const balances = netBalances(
      [
        { creatorId: 'alice', creatorName: 'Alice', shares: [share('bob', 'Bob', 2000)] },
        { creatorId: 'bob', creatorName: 'Bob', shares: [share('alice', 'Alice', 500)] },
      ],
      'alice',
    );
    expect(balances).toEqual([{ userId: 'bob', name: 'Bob', netCents: 1500 }]);
  });

  test('confirmed (settled) shares contribute nothing', () => {
    const balances = netBalances(
      [
        {
          creatorId: 'alice',
          creatorName: 'Alice',
          shares: [share('bob', 'Bob', 2000, 'confirmed')],
        },
      ],
      'alice',
    );
    expect(balances).toEqual([]);
  });

  test('paid-but-unconfirmed shares still count as outstanding', () => {
    const balances = netBalances(
      [{ creatorId: 'alice', creatorName: 'Alice', shares: [share('bob', 'Bob', 2000, 'paid')] }],
      'alice',
    );
    expect(balances).toEqual([{ userId: 'bob', name: 'Bob', netCents: 2000 }]);
  });

  test('a fully netted-to-zero pair drops out', () => {
    const balances = netBalances(
      [
        { creatorId: 'alice', creatorName: 'Alice', shares: [share('bob', 'Bob', 1000)] },
        { creatorId: 'bob', creatorName: 'Bob', shares: [share('alice', 'Alice', 1000)] },
      ],
      'alice',
    );
    expect(balances).toEqual([]);
  });
});

describe('parseReceiptText', () => {
  test('reads items and a labelled total', () => {
    const draft = parseReceiptText('Milk 1.50\nBread 2,00\nTOTAL 3.50');
    expect(draft.items).toEqual([
      { label: 'Milk', amountCents: 150 },
      { label: 'Bread', amountCents: 200 },
    ]);
    expect(draft.totalCents).toBe(350);
  });

  test('skips subtotal and tax lines but still finds items', () => {
    const draft = parseReceiptText('Apples 3.00\nSubtotal 3.00\nVAT 0.18\nTotaal 3.18');
    expect(draft.items).toEqual([{ label: 'Apples', amountCents: 300 }]);
    expect(draft.totalCents).toBe(318);
  });

  test('falls back to the largest price when no total keyword is present', () => {
    const draft = parseReceiptText('Cheese 5.00\nWine 12.50');
    expect(draft.totalCents).toBe(1250);
  });

  test('returns an empty draft on junk input without throwing', () => {
    const draft = parseReceiptText('~~~ unreadable ~~~');
    expect(draft.items).toEqual([]);
    expect(draft.totalCents).toBe(0);
  });
});

describe('formatEuros', () => {
  test('formats positive, zero and negative cents', () => {
    expect(formatEuros(4250)).toBe('€42.50');
    expect(formatEuros(0)).toBe('€0.00');
    expect(formatEuros(-800)).toBe('-€8.00');
  });
});
