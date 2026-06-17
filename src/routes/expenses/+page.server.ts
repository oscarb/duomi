import type { PageServerLoad, Actions } from './$types';
import { getMonthlyIncomes, getAccounts, addExpense, updateExpenseAmount, archiveExpense, unarchiveExpense, addAccount, deleteAccount as deleteAccountQuery, restoreAccount as restoreAccountQuery, deleteExpenseAmount, restoreExpenseAmount } from '$lib/server/db/queries';
import { db } from '$lib/server/db';
import { expenses, expenseAmounts, incomes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + 1;

	const income = await getMonthlyIncomes(year, month);
	const totalIncome = income.totalIncomeA + income.totalIncomeB;
	let pctA = totalIncome > 0 ? Math.round((income.totalIncomeA / totalIncome) * 100) / 100 : 0.5;

	if (totalIncome === 0) {
		const allIncomes = await db.select().from(incomes).all();
		let sortedWithIncomes = allIncomes
			.filter(inc => inc.totalIncomeA + inc.totalIncomeB > 0 && (inc.year < year || (inc.year === year && inc.month <= month)))
			.sort((a, b) => b.year - a.year || b.month - a.month);
		
		if (sortedWithIncomes.length === 0) {
			sortedWithIncomes = allIncomes
				.filter(inc => inc.totalIncomeA + inc.totalIncomeB > 0)
				.sort((a, b) => b.year - a.year || b.month - a.month);
		}

		if (sortedWithIncomes.length > 0) {
			const latest = sortedWithIncomes[0];
			const latestTotal = latest.totalIncomeA + latest.totalIncomeB;
			pctA = Math.round((latest.totalIncomeA / latestTotal) * 100) / 100;
		}
	}

	const allAccounts = await getAccounts();
	const dbExpenses = await db.select().from(expenses).all();

	const mappedExpenses = [];
	for (const expense of dbExpenses) {
		const history = await db
			.select({
				id: expenseAmounts.id,
				amount: expenseAmounts.amount,
				validFrom: expenseAmounts.validFrom
			})
			.from(expenseAmounts)
			.where(eq(expenseAmounts.expenseId, expense.id))
			.orderBy(expenseAmounts.validFrom)
			.all();

		const targetLastDay = `${year}-${String(month).padStart(2, '0')}-31`;
		const activeCost = [...history]
			.filter(c => c.validFrom <= targetLastDay)
			.sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];

		const currentAmount = activeCost ? activeCost.amount : (history[0]?.amount || 0);

		let nextPaymentDate: string | null = null;
		if (expense.intervalMonths > 0 && activeCost) {
			const costParts = activeCost.validFrom.split('-');
			const costY = parseInt(costParts[0], 10);
			const costM = parseInt(costParts[1], 10);
			
			const diff = (year - costY) * 12 + (month - costM);
			if (diff >= 0) {
				const remainder = diff % expense.intervalMonths;
				const monthsToAdd = expense.intervalMonths - remainder;
				const nextMonthTotal = month + (remainder === 0 ? 0 : monthsToAdd);
				const nextY = year + Math.floor((nextMonthTotal - 1) / 12);
				const nextM = ((nextMonthTotal - 1) % 12) + 1;
				nextPaymentDate = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
			}
		}

		const latestAmount = history[history.length - 1]?.amount || 0;

		mappedExpenses.push({
			id: expense.id,
			name: expense.name,
			paidBy: expense.paidBy as 'A' | 'B',
			accountId: expense.accountId,
			intervalMonths: expense.intervalMonths,
			splitType: expense.splitType as 'dynamic' | 'static',
			staticSplitRatio: expense.staticSplitRatio,
			currentAmount: currentAmount,
			latestAmount: latestAmount,
			nextPaymentDate: nextPaymentDate,
			archivedDate: expense.archivedDate,
			history: history
		});
	}

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
