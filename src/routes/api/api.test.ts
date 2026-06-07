import { describe, it, expect, beforeEach } from 'vitest';
import { GET as getOverview, POST as postOverview } from './overview/+server';
import { GET as getExpenses, POST as postExpenses, PUT as putExpenses, DELETE as deleteExpenses } from './expenses/+server';
import { sqlite } from '$lib/server/db';
import { addAccount } from '$lib/server/db/queries';

describe('API Endpoints Integration', () => {
	beforeEach(() => {
		sqlite.exec('DELETE FROM expense_amounts');
		sqlite.exec('DELETE FROM expenses');
		sqlite.exec('DELETE FROM accounts');
		sqlite.exec('DELETE FROM incomes');
	});

	it('should handle incomes and calculate overview calculations via /api/overview', async () => {
		// 1. Post Income (Set to Partner A 4000, Partner B 2000 => 2/3 and 1/3)
		const postReq = new Request('http://localhost/api/overview', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ year: 2026, month: 8, incomeA: 4000, incomeB: 2000 })
		});
		
		const postRes = await postOverview({ request: postReq } as any);
		const postData = await postRes.json();
		expect(postData.success).toBe(true);

		// 2. Add Account and Expense
		const acc = await addAccount('Shared Bank', 'A');
		
		const createExpenseReq = new Request('http://localhost/api/expenses', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'Rent',
				paidBy: 'A',
				intervalMonths: 1,
				splitType: 'dynamic',
				accountId: acc.id,
				amount: 900,
				validFrom: '2026-08-01'
			})
		});
		await postExpenses({ request: createExpenseReq } as any);

		// 3. Get Overview
		const url = new URL('http://localhost/api/overview?year=2026&month=8');
		const getRes = await getOverview({ url } as any);
		const data = await getRes.json();

		expect(data.period.year).toBe(2026);
		expect(data.period.month).toBe(8);
		expect(data.income.total).toBe(6000);
		expect(data.income.person_a.percentage).toBe(0.67);
		expect(data.income.person_b.percentage).toBe(0.33);

		// Rent is 900. Paid by A (Partner A).
		// Partner A owes 2/3 (600), Partner B owes 1/3 (300).
		// Partner B owes Partner A 300.
		expect(data.settlement.payer).toBe('B');
		expect(data.settlement.amount).toBe(300);

		expect(data.expenses.items.length).toBe(1);
		expect(data.expenses.items[0].name).toBe('Rent');
		expect(data.expenses.items[0].amount).toBe(900);
		expect(data.expenses.items[0].account).toBe('Shared Bank');
	});

	it('should support full CRUD for expenses via /api/expenses', async () => {
		// 1. Get Expenses initially (empty)
		const getRes1 = await getExpenses({ url: new URL('http://localhost/api/expenses?year=2026&month=8') } as any);
		const data1 = await getRes1.json();
		expect(data1.expenses.length).toBe(0);

		// 2. Post New Expense
		const postReq = new Request('http://localhost/api/expenses', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'Electricity',
				paidBy: 'B',
				intervalMonths: 1,
				splitType: 'static',
				staticSplitRatio: 0.5,
				amount: 150,
				validFrom: '2026-08-01'
			})
		});
		const postRes = await postExpenses({ request: postReq } as any);
		const postData = await postRes.json();
		expect(postData.success).toBe(true);
		const expenseId = postData.id;

		// 3. Put/Update Expense name & cost
		const putReq = new Request('http://localhost/api/expenses', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id: expenseId,
				name: 'Electricity Updated',
				amount: 160,
				validFrom: '2026-08-01'
			})
		});
		const putRes = await putExpenses({ request: putReq } as any);
		expect((await putRes.json()).success).toBe(true);

		// 4. Archive/Delete Expense
		const deleteReq = new Request('http://localhost/api/expenses', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id: expenseId,
				archivedDate: '2026-08-15'
			})
		});
		const deleteRes = await deleteExpenses({ request: deleteReq } as any);
		expect((await deleteRes.json()).success).toBe(true);

		// Verify archived date is set in DB
		const getRes2 = await getExpenses({ url: new URL('http://localhost/api/expenses?year=2026&month=8') } as any);
		const data2 = await getRes2.json();
		expect(data2.expenses.length).toBe(1);
		expect(data2.expenses[0].name).toBe('Electricity Updated');
		expect(data2.expenses[0].current_amount).toBe(160);
		expect(data2.expenses[0].archived_date).toBe('2026-08-15');
	});
});
