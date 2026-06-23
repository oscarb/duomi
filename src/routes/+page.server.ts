import type { PageServerLoad, Actions } from './$types';
import {
	getResolvedMonthlyIncomes,
	getActiveExpensesForMonth,
	getAccounts,
	archiveExpense,
	unarchiveExpense,
	deleteExpenseAmount,
	restoreExpenseAmount,
	getExpensesWithMappedHistory
} from '$lib/server/db/queries';
import { calculateSettlement } from '$lib/calculations';
import { db } from '$lib/server/db';
import { incomes } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ url }) => {
	const now = new Date();
	const year = parseInt(url.searchParams.get('year') || now.getFullYear().toString(), 10);
	const month = parseInt(url.searchParams.get('month') || (now.getMonth() + 1).toString(), 10);

	const resolvedIncome = await getResolvedMonthlyIncomes(year, month);
	const activeExpenses = await getActiveExpensesForMonth(year, month);

	const mappedExpenses = activeExpenses.map(e => ({
		id: e.id,
		name: e.name,
		paidBy: e.paidBy,
		splitType: e.splitType,
		staticSplitRatio: e.staticSplitRatio,
		amount: e.amount,
		latestAmount: e.latestAmount
	}));

	const incomeA = resolvedIncome.totalIncomeA;
	const incomeB = resolvedIncome.totalIncomeB;
	const isFallbackA = resolvedIncome.isFallbackA;
	const isFallbackB = resolvedIncome.isFallbackB;
	const isFallback = resolvedIncome.isFallback;

	const settlement = calculateSettlement(incomeA, incomeB, mappedExpenses);

	const totalIncome = incomeA + incomeB;
	const pctA = totalIncome > 0 ? Math.round((incomeA / totalIncome) * 100) / 100 : 0.5;
	const pctB = totalIncome > 0 ? Math.round((incomeB / totalIncome) * 100) / 100 : 0.5;

	const totalExpensesAmount = activeExpenses.reduce((sum, e) => sum + e.amount, 0);

	interface Account {
		id: number;
		name: string;
		owner: string;
	}

	interface ExpenseHistoryItem {
		amount: number;
		validFrom: string;
	}

	interface ExpenseTemplate {
		id: number;
		name: string;
		paidBy: 'A' | 'B';
		accountId: number | null;
		intervalMonths: number;
		splitType: 'dynamic' | 'static';
		staticSplitRatio: number | null;
		currentAmount: number;
		nextPaymentDate: string | null;
		archivedDate: string | null;
		history: ExpenseHistoryItem[];
	}

	let accounts: Account[] = [];
	let allExpensesTemplates: ExpenseTemplate[] = [];
	if (url.searchParams.has('id') || url.searchParams.has('new')) {
		accounts = await getAccounts();
		allExpensesTemplates = await getExpensesWithMappedHistory(year, month, false) as any[];
	}

	return {
		period: { year, month },
		settlement,
		income: {
			total: totalIncome,
			person_a: incomeA,
			person_a_pct: pctA,
			person_b: incomeB,
			person_b_pct: pctB,
			isFallbackA,
			isFallbackB,
			isFallback
		},
		expenses: {
			total: totalExpensesAmount,
			items: activeExpenses
		},
		accounts,
		templates: allExpensesTemplates,
		dynamicSplitRatioA: pctA
	};
};

export const actions = {
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

