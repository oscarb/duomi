import type { PageServerLoad } from './$types';
import { getMonthlyIncomes, getActiveExpensesForMonth } from '$lib/server/db/queries';
import { calculateSettlement } from '$lib/calculations';
import { db } from '$lib/server/db';
import { incomes } from '$lib/server/db/schema';

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
		} else if (validIncomes.length > 0) {
			validIncomes.sort((a, b) => b.year - a.year || b.month - a.month);
			fallbackIncome = validIncomes[0];
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
		}
	};
};

