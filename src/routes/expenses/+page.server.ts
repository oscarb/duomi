import type { PageServerLoad, Actions } from './$types';
import { getMonthlyIncomes, getAccounts, addExpense, updateExpenseCost, archiveExpense, addAccount } from '$lib/server/db/queries';
import { db } from '$lib/server/db';
import { expenses, expenseCosts, incomes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url }) => {
	const now = new Date();
	const year = parseInt(url.searchParams.get('year') || now.getFullYear().toString(), 10);
	const month = parseInt(url.searchParams.get('month') || (now.getMonth() + 1).toString(), 10);

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
				amount: expenseCosts.amount,
				validFrom: expenseCosts.validFrom
			})
			.from(expenseCosts)
			.where(eq(expenseCosts.expenseId, expense.id))
			.orderBy(expenseCosts.validFrom)
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

		mappedExpenses.push({
			id: expense.id,
			name: expense.name,
			paidBy: expense.paidBy as 'A' | 'B',
			accountId: expense.accountId,
			intervalMonths: expense.intervalMonths,
			splitType: expense.splitType as 'dynamic' | 'static',
			staticSplitRatio: expense.staticSplitRatio,
			currentAmount: currentAmount,
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

		return { success: true };
	},

	updatePrice: async ({ request }) => {
		const data = await request.formData();
		const expenseId = parseInt(data.get('id') as string, 10);
		const amount = Math.round(parseFloat(data.get('amount') as string) || 0);
		const validFrom = data.get('validFrom') as string;

		await updateExpenseCost(expenseId, amount, validFrom);
		return { success: true };
	},

	archive: async ({ request }) => {
		const data = await request.formData();
		const expenseId = parseInt(data.get('id') as string, 10);
		const archivedDate = data.get('archivedDate') as string || new Date().toISOString().split('T')[0];

		await archiveExpense(expenseId, archivedDate);
		return { success: true };
	},

	createAccount: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name') as string;
		const owner = data.get('owner') as 'A' | 'B';

		if (!name || !owner) return { success: false };

		await addAccount(name, owner);
		return { success: true };
	}
} satisfies Actions;
