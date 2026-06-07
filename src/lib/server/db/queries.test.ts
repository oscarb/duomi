import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, sqlite } from './index';
import { incomes, accounts, expenses, expenseAmounts } from './schema';
import { getMonthlyIncomes, setMonthlyIncome, getActiveExpensesForMonth, addExpense, addAccount, getAccounts } from './queries';
import { eq } from 'drizzle-orm';

describe('Database Queries', () => {
	beforeEach(() => {
		// Clean the database tables before each test
		sqlite.exec('DELETE FROM expense_amounts');
		sqlite.exec('DELETE FROM expenses');
		sqlite.exec('DELETE FROM accounts');
		sqlite.exec('DELETE FROM incomes');
	});

	afterEach(() => {
		// Clean up
	});

	it('should set and get monthly incomes correctly', async () => {
		await setMonthlyIncome(2026, 8, 4500, 3000);
		const result = await getMonthlyIncomes(2026, 8);
		expect(result.totalIncomeA).toBe(4500);
		expect(result.totalIncomeB).toBe(3000);
	});

	it('should return zeros for monthly incomes if not set', async () => {
		const result = await getMonthlyIncomes(2026, 8);
		expect(result.totalIncomeA).toBe(0);
		expect(result.totalIncomeB).toBe(0);
	});

	it('should add and retrieve accounts', async () => {
		await addAccount('Main Bank Account', 'A');
		await addAccount('Revolut', 'B');

		const list = await getAccounts();
		expect(list.length).toBe(2);
		expect(list[0].name).toBe('Main Bank Account');
		expect(list[0].owner).toBe('A');
	});

	it('should filter active expenses and fetch correct pricing history', async () => {
		// 1. Add account
		const [acc] = await db.insert(accounts).values({ name: 'Main Account', owner: 'A' }).returning();

		// 2. Add monthly recurring expense (Rent)
		// Active from 2026-08-01, cost 2400.
		const rentId = await addExpense('Rent', 'A', 1, 'dynamic', null, acc.id, 2400, '2026-08-01');

		// 3. Add an expense that starts in the future (e.g. 2026-09-01) - should NOT show in 2026-08
		await addExpense('Gym', 'B', 1, 'static', 0.5, acc.id, 50, '2026-09-01');

		// 4. Add a one-time expense in 2026-08 - should show in 2026-08
		await addExpense('Dinner', 'B', 0, 'dynamic', null, acc.id, 120, '2026-08-15');

		// 5. Add a one-time expense in 2026-07 - should NOT show in 2026-08
		await addExpense('Cinema', 'B', 0, 'dynamic', null, acc.id, 30, '2026-07-20');

		// 6. Test active expenses for August 2026 (2026-08)
		const augExpenses = await getActiveExpensesForMonth(2026, 8);
		expect(augExpenses.length).toBe(2); // Rent and Dinner
		
		const rent = augExpenses.find(e => e.name === 'Rent');
		const dinner = augExpenses.find(e => e.name === 'Dinner');

		expect(rent).toBeDefined();
		expect(rent?.amount).toBe(2400);
		expect(rent?.paidBy).toBe('A');
		
		expect(dinner).toBeDefined();
		expect(dinner?.amount).toBe(120);

		// 7. Test active expenses for September 2026 (2026-09)
		// Dinner should not show because it's one-time in August.
		// Gym should show now.
		const septExpenses = await getActiveExpensesForMonth(2026, 9);
		expect(septExpenses.length).toBe(2); // Rent and Gym
		expect(septExpenses.some(e => e.name === 'Gym')).toBe(true);
		expect(septExpenses.some(e => e.name === 'Dinner')).toBe(false);
	});
});
