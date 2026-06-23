import type { PageServerLoad, Actions } from './$types';
import {
	getResolvedMonthlyIncomes,
	getAccounts,
	addExpense,
	updateExpenseAmount,
	archiveExpense,
	unarchiveExpense,
	addAccount,
	deleteAccount as deleteAccountQuery,
	restoreAccount as restoreAccountQuery,
	deleteExpenseAmount,
	restoreExpenseAmount,
	getExpensesWithMappedHistory
} from '$lib/server/db/queries';
import { db } from '$lib/server/db';
import { incomes, expenses } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + 1;

	const resolvedIncome = await getResolvedMonthlyIncomes(year, month);
	const incomeA = resolvedIncome.totalIncomeA;
	const incomeB = resolvedIncome.totalIncomeB;
	const totalIncome = incomeA + incomeB;
	const pctA = totalIncome > 0 ? Math.round((incomeA / totalIncome) * 100) / 100 : 0.5;

	const allAccounts = await getAccounts();
	const mappedExpenses = await getExpensesWithMappedHistory(year, month, false);

	return {
		dynamicSplitRatioA: pctA,
		expenses: mappedExpenses,
		accounts: allAccounts,
		period: { year, month }
	};
};

export const actions = {
	create: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name') as string;
		const paidBy = data.get('paidBy') as 'A' | 'B';
		const intervalMonths = parseInt(data.get('intervalMonths') as string, 10);
		const splitType = data.get('splitType') as 'dynamic' | 'static';
		
		const staticSplitRatioRaw = data.get('staticSplitRatio') as string;
		const staticSplitRatio = splitType === 'static' ? parseFloat(staticSplitRatioRaw) : null;
		
		const accountIdRaw = data.get('accountId') as string;
		const accountId = accountIdRaw ? parseInt(accountIdRaw, 10) : null;

		const amount = Math.round(parseFloat(data.get('amount') as string) || 0);
		const validFrom = data.get('validFrom') as string || new Date().toISOString().split('T')[0];

		const newId = await addExpense(
			name,
			paidBy,
			intervalMonths,
			splitType,
			staticSplitRatio,
			accountId,
			amount,
			validFrom
		);

		return { success: true, id: newId };
	},

	update: async ({ request }) => {
		const data = await request.formData();
		const id = parseInt(data.get('id') as string, 10);
		const name = data.get('name') as string;
		const paidBy = data.get('paidBy') as 'A' | 'B';
		const intervalMonths = parseInt(data.get('intervalMonths') as string, 10);
		const splitType = data.get('splitType') as 'dynamic' | 'static';
		
		const staticSplitRatioRaw = data.get('staticSplitRatio') as string;
		const staticSplitRatio = splitType === 'static' ? parseFloat(staticSplitRatioRaw) : null;
		
		const accountIdRaw = data.get('accountId') as string;
		const accountId = accountIdRaw ? parseInt(accountIdRaw, 10) : null;

		const updateFields: any = {};
		if (name !== undefined) updateFields.name = name;
		if (paidBy !== undefined) updateFields.paidBy = paidBy;
		if (intervalMonths !== undefined) updateFields.intervalMonths = intervalMonths;
		if (splitType !== undefined) updateFields.splitType = splitType;
		if (staticSplitRatio !== undefined) updateFields.staticSplitRatio = staticSplitRatio;
		if (accountId !== undefined) updateFields.accountId = accountId;

		await db
			.update(expenses)
			.set(updateFields)
			.where(eq(expenses.id, id))
			.run();

		const amountStr = data.get('amount') as string;
		if (amountStr) {
			const expense = await db.select().from(expenses).where(eq(expenses.id, id)).get();
			if (!expense?.archivedDate) {
				const amount = Math.round(parseFloat(amountStr) || 0);
				const validFrom = data.get('validFrom') as string || new Date().toISOString().split('T')[0];
				await updateExpenseAmount(id, amount, validFrom);
			}
		}

		return { success: true };
	},

	updateAmount: async ({ request }) => {
		const data = await request.formData();
		const expenseId = parseInt(data.get('id') as string, 10);
		
		const expense = await db.select().from(expenses).where(eq(expenses.id, expenseId)).get();
		if (!expense || expense.archivedDate) {
			return { success: false, error: 'Cannot update amount of an archived expense' };
		}

		const amount = Math.round(parseFloat(data.get('amount') as string) || 0);
		const validFrom = data.get('validFrom') as string;

		await updateExpenseAmount(expenseId, amount, validFrom);
		return { success: true };
	},

	archive: async ({ request }) => {
		const data = await request.formData();
		const expenseId = parseInt(data.get('id') as string, 10);
		const archivedDate = data.get('archivedDate') as string || new Date().toISOString().split('T')[0];

		await archiveExpense(expenseId, archivedDate);
		return { success: true };
	},

	unarchive: async ({ request }) => {
		const data = await request.formData();
		const expenseId = parseInt(data.get('id') as string, 10);
		await unarchiveExpense(expenseId);
		return { success: true };
	},

	createAccount: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name') as string;
		const owner = data.get('owner') as 'A' | 'B';

		if (!name || !owner) return { success: false };

		await addAccount(name, owner);
		return { success: true };
	},

	deleteAccount: async ({ request }) => {
		const data = await request.formData();
		const id = parseInt(data.get('id') as string, 10);
		if (!id) return { success: false };

		const deleted = await deleteAccountQuery(id);
		return { success: true, deleted };
	},

	restoreAccount: async ({ request }) => {
		const data = await request.formData();
		const id = parseInt(data.get('id') as string, 10);
		const name = data.get('name') as string;
		const owner = data.get('owner') as 'A' | 'B';
		const affectedExpenseIdsRaw = data.get('affectedExpenseIds') as string;
		const affectedExpenseIds = affectedExpenseIdsRaw ? JSON.parse(affectedExpenseIdsRaw) : [];

		if (!id || !name || !owner) return { success: false };

		await restoreAccountQuery(id, name, owner, affectedExpenseIds);
		return { success: true };
	},

	deleteHistoryItem: async ({ request }) => {
		const data = await request.formData();
		const id = parseInt(data.get('id') as string, 10);
		if (!id) return { success: false };

		try {
			const deleted = await deleteExpenseAmount(id);
			return { success: true, deleted };
		} catch (err: any) {
			return { success: false, error: err.message || 'failed' };
		}
	},

	restoreHistoryItem: async ({ request }) => {
		const data = await request.formData();
		const id = parseInt(data.get('id') as string, 10);
		const expenseId = parseInt(data.get('expenseId') as string, 10);
		const amount = parseInt(data.get('amount') as string, 10);
		const validFrom = data.get('validFrom') as string;

		if (!id || !expenseId || isNaN(amount) || !validFrom) return { success: false };

		await restoreExpenseAmount(id, expenseId, amount, validFrom);
		return { success: true };
	}
} satisfies Actions;
