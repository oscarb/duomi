import { describe, it, expect } from 'vitest';
import { calculateSettlement } from '../calculations';

describe('calculateSettlement', () => {
	it('should return zero settlement if there are no expenses', () => {
		const result = calculateSettlement(3000, 2000, []);
		expect(result.payer).toBeNull();
		expect(result.amount).toBe(0);
		expect(result.ratioA).toBe(0.6);
		expect(result.ratioB).toBe(0.4);
	});

	it('should calculate dynamic splits correctly based on income ratio (60/40)', () => {
		const incomeA = 6000;
		const incomeB = 4000;
		// Total income: 10000, ratio A: 0.6, ratio B: 0.4
		// Expense paid by A: 100. A's share: 60, B's share: 40. B owes A 40.
		const expenses = [
			{
				id: 1,
				name: 'Internet',
				paidBy: 'A' as const,
				splitType: 'dynamic' as const,
				staticSplitRatio: null,
				amount: 100
			}
		];

		const result = calculateSettlement(incomeA, incomeB, expenses);
		expect(result.payer).toBe('B');
		expect(result.amount).toBe(40);
		expect(result.ratioA).toBe(0.6);
		expect(result.ratioB).toBe(0.4);
	});

	it('should calculate static splits correctly, ignoring income ratio', () => {
		const incomeA = 6000;
		const incomeB = 4000;
		// Static split 50/50 (staticSplitRatio = 0.5 is A's share).
		// Expense paid by B: 100. A's share: 50, B's share: 50. A owes B 50.
		const expenses = [
			{
				id: 1,
				name: 'Netflix',
				paidBy: 'B' as const,
				splitType: 'static' as const,
				staticSplitRatio: 0.5,
				amount: 100
			}
		];

		const result = calculateSettlement(incomeA, incomeB, expenses);
		expect(result.payer).toBe('A');
		expect(result.amount).toBe(50);
	});

	it('should fall back to 50/50 dynamic split if total income is zero', () => {
		// Expense paid by A: 200. Split 50/50. B owes A 100.
		const expenses = [
			{
				id: 1,
				name: 'Groceries',
				paidBy: 'A' as const,
				splitType: 'dynamic' as const,
				staticSplitRatio: null,
				amount: 200
			}
		];

		const result = calculateSettlement(0, 0, expenses);
		expect(result.payer).toBe('B');
		expect(result.amount).toBe(100);
		expect(result.ratioA).toBe(0.5);
		expect(result.ratioB).toBe(0.5);
	});

	it('should net out multiple expenses with different payers and split types', () => {
		const incomeA = 3000;
		const incomeB = 2000; // ratio A: 0.6, ratio B: 0.4
		
		const expenses = [
			// Paid by A: 100 (dynamic). A owes 60, B owes 40 to A.
			{
				id: 1,
				name: 'Rent Part 1',
				paidBy: 'A' as const,
				splitType: 'dynamic' as const,
				staticSplitRatio: null,
				amount: 100
			},
			// Paid by B: 200 (static 70/30 - A's share 0.7). A owes B 140.
			{
				id: 2,
				name: 'Electricity',
				paidBy: 'B' as const,
				splitType: 'static' as const,
				staticSplitRatio: 0.7,
				amount: 200
			}
		];

		// Net: B owes A 40. A owes B 140.
		// Net result: A owes B 100.
		const result = calculateSettlement(incomeA, incomeB, expenses);
		expect(result.payer).toBe('A');
		expect(result.amount).toBe(100);
	});
});
