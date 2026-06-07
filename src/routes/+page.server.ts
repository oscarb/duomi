import type { PageServerLoad } from './$types';
import { getMonthlyIncomes, getActiveExpensesForMonth, getAccounts } from '$lib/server/db/queries';
import { calculateSettlement } from '$lib/calculations';
import { db } from '$lib/server/db';
import { incomes, expenses, expenseAmounts } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url }) => {
	const now = new Date();
	const year = parseInt(url.searchParams.get('year') || now.getFullYear().toString(), 10);
	const month = parseInt(url.searchParams.get('month') || (now.getMonth() + 1).toString(), 10);

	const income = await getMonthlyIncomes(year, month);
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

	let incomeA = income.totalIncomeA;
	let incomeB = income.totalIncomeB;
	let isFallback = false;

	if (incomeA === 0 && incomeB === 0) {
		const allIncomes = await db.select().from(incomes).all();
		const validIncomes = allIncomes.filter(inc => inc.totalIncomeA + inc.totalIncomeB > 0);
		const pastIncomes = validIncomes.filter(inc => inc.year < year || (inc.year === year && inc.month < month));
		pastIncomes.sort((a, b) => b.year - a.year || b.month - a.month);

		let fallbackIncome = null;
		if (pastIncomes.length > 0) {
			fallbackIncome = pastIncomes[0];
		}

		if (fallbackIncome) {
			incomeA = fallbackIncome.totalIncomeA;
			incomeB = fallbackIncome.totalIncomeB;
			isFallback = true;
		}
	}

	const settlement = calculateSettlement(incomeA, incomeB, mappedExpenses);

	const totalIncome = incomeA + incomeB;
	const pctA = totalIncome > 0 ? Math.round((incomeA / totalIncome) * 100) / 100 : 0.5;
	const pctB = totalIncome > 0 ? Math.round((incomeB / totalIncome) * 100) / 100 : 0.5;

	const totalExpensesAmount = activeExpenses.reduce((sum, e) => sum + e.amount, 0);

	let accounts: any[] = [];
	let allExpensesTemplates: any[] = [];
	if (url.searchParams.has('id') || url.searchParams.has('new')) {
		accounts = await getAccounts();
		
		const dbExpenses = await db.select().from(expenses).all();
		for (const expense of dbExpenses) {
			const history = await db
				.select({
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

			allExpensesTemplates.push({
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

