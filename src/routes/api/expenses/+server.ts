import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { expenses, expenseAmounts, accounts } from '$lib/server/db/schema';
import {
	getMonthlyIncomes,
	addExpense,
	updateExpenseAmount,
	archiveExpense,
	getAccounts
} from '$lib/server/db/queries';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	const now = new Date();
	const year = parseInt(url.searchParams.get('year') || now.getFullYear().toString(), 10);
	const month = parseInt(url.searchParams.get('month') || (now.getMonth() + 1).toString(), 10);

	const income = await getMonthlyIncomes(year, month);
	const totalIncome = income.totalIncomeA + income.totalIncomeB;
	const pctA = totalIncome > 0 ? Math.round((income.totalIncomeA / totalIncome) * 100) / 100 : 0.5;

	// Load all accounts
	const allAccounts = await getAccounts();

	// Load all expenses (both active and archived, so the frontend can display history / manage archived ones)
	const dbExpenses = await db.select().from(expenses).all();

	const mappedExpenses = [];

	for (const expense of dbExpenses) {
		const history = await db
			.select({
				amount: expenseAmounts.amount,
				valid_from: expenseAmounts.validFrom
			})
			.from(expenseAmounts)
			.where(eq(expenseAmounts.expenseId, expense.id))
			.orderBy(expenseAmounts.validFrom)
			.all();

		// Current amount is the cost active in the target year/month (latest valid_from <= targetLastDay)
		const targetLastDay = `${year}-${String(month).padStart(2, '0')}-31`;
		const activeCost = [...history]
			.filter(c => c.valid_from <= targetLastDay)
			.sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];

		const currentAmount = activeCost ? activeCost.amount : (history[0]?.amount || 0);

		// Calculate next payment date
		let nextPaymentDate: string | null = null;
		if (expense.intervalMonths > 0 && activeCost) {
			const costParts = activeCost.valid_from.split('-');
			const costY = parseInt(costParts[0], 10);
			const costM = parseInt(costParts[1], 10);
			
			// Month diff relative to target month
			const diff = (year - costY) * 12 + (month - costM);
			if (diff >= 0) {
				// Next payment is target month or next interval month
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
			paid_by: expense.paidBy,
			account_id: expense.accountId,
			interval_months: expense.intervalMonths,
			split_type: expense.splitType,
			static_split_ratio: expense.staticSplitRatio,
			current_amount: currentAmount,
			next_payment_date: nextPaymentDate,
			archived_date: expense.archivedDate,
			history: history
		});
	}

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
