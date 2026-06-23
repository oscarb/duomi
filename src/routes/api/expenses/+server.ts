import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { expenses } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
	getResolvedMonthlyIncomes,
	addExpense,
	updateExpenseAmount,
	archiveExpense,
	getAccounts,
	getExpensesWithMappedHistory
} from '$lib/server/db/queries';

export const GET: RequestHandler = async ({ url }) => {
	const now = new Date();
	const year = parseInt(url.searchParams.get('year') || now.getFullYear().toString(), 10);
	const month = parseInt(url.searchParams.get('month') || (now.getMonth() + 1).toString(), 10);

	const resolvedIncome = await getResolvedMonthlyIncomes(year, month);
	const incomeA = resolvedIncome.totalIncomeA;
	const incomeB = resolvedIncome.totalIncomeB;
	const totalIncome = incomeA + incomeB;
	const pctA = totalIncome > 0 ? Math.round((incomeA / totalIncome) * 100) / 100 : 0.5;

	// Load all accounts
	const allAccounts = await getAccounts();

	// Load and map all expenses (both active and archived)
	const mappedExpenses = (await getExpensesWithMappedHistory(year, month, false)).map(e => ({
		id: e.id,
		name: e.name,
		paid_by: e.paidBy,
		account_id: e.accountId,
		interval_months: e.intervalMonths,
		split_type: e.splitType,
		static_split_ratio: e.staticSplitRatio,
		current_amount: e.currentAmount,
		next_payment_date: e.nextPaymentDate,
		archived_date: e.archivedDate,
		history: e.history.map(h => ({
			amount: h.amount,
			valid_from: h.validFrom
		}))
	}));

	return json({
		dynamic_split_ratio_a: pctA,
		expenses: mappedExpenses,
		accounts: allAccounts
	});
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const {
		name,
		paidBy,
		intervalMonths,
		splitType,
		staticSplitRatio,
		accountId,
		amount,
		validFrom
	} = body;

	if (
		!name ||
		!paidBy ||
		intervalMonths === undefined ||
		!splitType ||
		amount === undefined ||
		!validFrom
	) {
		return json({ error: 'Missing parameters' }, { status: 400 });
	}

	const newId = await addExpense(
		name,
		paidBy,
		intervalMonths,
		splitType,
		staticSplitRatio !== undefined ? staticSplitRatio : null,
		accountId !== undefined ? accountId : null,
		amount,
		validFrom
	);

	return json({ success: true, id: newId });
};

export const PUT: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const {
		id,
		name,
		paidBy,
		intervalMonths,
		splitType,
		staticSplitRatio,
		accountId,
		amount,
		validFrom,
		archivedDate
	} = body;

	if (!id) {
		return json({ error: 'Missing expense ID' }, { status: 400 });
	}

	// Update base fields in expenses
	const updateFields: any = {};
	if (name !== undefined) updateFields.name = name;
	if (paidBy !== undefined) updateFields.paidBy = paidBy;
	if (intervalMonths !== undefined) updateFields.intervalMonths = intervalMonths;
	if (splitType !== undefined) updateFields.splitType = splitType;
	if (staticSplitRatio !== undefined) updateFields.staticSplitRatio = staticSplitRatio;
	if (accountId !== undefined) updateFields.accountId = accountId;
	if (archivedDate !== undefined) updateFields.archivedDate = archivedDate;

	if (Object.keys(updateFields).length > 0) {
		await db
			.update(expenses)
			.set(updateFields)
			.where(eq(expenses.id, id))
			.run();
	}

	// Update or insert amount if amount and validFrom are supplied
	if (amount !== undefined && validFrom !== undefined) {
		await updateExpenseAmount(id, amount, validFrom);
	}

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ request }) => {
	// Archive the expense instead of hard-deleting
	const body = await request.json();
	const { id, archivedDate } = body;

	if (!id) {
		return json({ error: 'Missing expense ID' }, { status: 400 });
	}

	const date = archivedDate || new Date().toISOString().split('T')[0];
	await archiveExpense(id, date);

	return json({ success: true });
};
