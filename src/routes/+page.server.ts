import type { PageServerLoad } from './$types';
import { getMonthlyIncomes, getActiveExpensesForMonth } from '$lib/server/db/queries';
import { calculateSettlement } from '$lib/calculations';

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
		amount: e.amount
	}));

	const settlement = calculateSettlement(income.totalIncomeA, income.totalIncomeB, mappedExpenses);

	const totalIncome = income.totalIncomeA + income.totalIncomeB;
	const pctA = totalIncome > 0 ? Math.round((income.totalIncomeA / totalIncome) * 100) / 100 : 0.5;
	const pctB = totalIncome > 0 ? Math.round((income.totalIncomeB / totalIncome) * 100) / 100 : 0.5;

	const totalExpensesAmount = activeExpenses.reduce((sum, e) => sum + e.amount, 0);

	return {
		period: { year, month },
		settlement,
		income: {
			total: totalIncome,
			person_a: income.totalIncomeA,
			person_a_pct: pctA,
			person_b: income.totalIncomeB,
			person_b_pct: pctB
		},
		expenses: {
			total: totalExpensesAmount,
			items: activeExpenses
		}
	};
};

