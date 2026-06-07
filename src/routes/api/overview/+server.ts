import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMonthlyIncomes, getActiveExpensesForMonth, setMonthlyIncome } from '$lib/server/db/queries';
import { calculateSettlement } from '$lib/calculations';

export const GET: RequestHandler = async ({ url }) => {
	const now = new Date();
	const year = parseInt(url.searchParams.get('year') || now.getFullYear().toString(), 10);
	const month = parseInt(url.searchParams.get('month') || (now.getMonth() + 1).toString(), 10);

	const income = await getMonthlyIncomes(year, month);
	const activeExpenses = await getActiveExpensesForMonth(year, month);

	// Map activeExpenses to calculations structure
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

	return json({
		period: { year, month },
		settlement: {
			payer: settlement.payer,
			amount: settlement.amount
		},
		income: {
			total: totalIncome,
			person_a: { amount: income.totalIncomeA, percentage: pctA },
			person_b: { amount: income.totalIncomeB, percentage: pctB }
		},
		expenses: {
			total: totalExpensesAmount,
			items: activeExpenses.map(e => ({
				id: e.id,
				name: e.name,
				amount: e.amount,
				paid_by: e.paidBy,
				split_type: e.splitType,
				split_ratio: e.splitType === 'static' ? e.staticSplitRatio : pctA,
				account: e.accountName
			}))
		}
	});
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { year, month, incomeA, incomeB } = body;

	if (
		typeof year !== 'number' ||
		typeof month !== 'number' ||
		typeof incomeA !== 'number' ||
		typeof incomeB !== 'number'
	) {
		return json({ error: 'Invalid parameters' }, { status: 400 });
	}

	await setMonthlyIncome(year, month, incomeA, incomeB);
	return json({ success: true });
};
