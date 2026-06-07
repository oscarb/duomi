import { db } from './index';
import { incomes, accounts, expenses, expenseAmounts } from './schema';
import { eq, and, or, isNull, gte, sql } from 'drizzle-orm';

// Helper to compute difference in months between YYYY-MM-DD and a target year/month
function getMonthDiff(validFromStr: string, targetYear: number, targetMonth: number): number {
	const parts = validFromStr.split('-');
	const y1 = parseInt(parts[0], 10);
	const m1 = parseInt(parts[1], 10);
	return (targetYear - y1) * 12 + (targetMonth - m1);
}

// 1. Incomes
export async function getMonthlyIncomes(year: number, month: number) {
	const result = await db
		.select()
		.from(incomes)
		.where(and(eq(incomes.year, year), eq(incomes.month, month)))
		.get();

	if (!result) {
		return { year, month, totalIncomeA: 0, totalIncomeB: 0 };
	}

	return result;
}

export async function setMonthlyIncome(year: number, month: number, incomeA: number, incomeB: number) {
	// Insert or update on conflict (year, month)
	await db
		.insert(incomes)
		.values({
			year,
			month,
			totalIncomeA: incomeA,
			totalIncomeB: incomeB
		})
		.onConflictDoUpdate({
			target: [incomes.year, incomes.month],
			set: {
				totalIncomeA: incomeA,
				totalIncomeB: incomeB
			}
		})
		.run();
}

// 2. Accounts
export async function getAccounts() {
	return db.select().from(accounts).all();
}

export async function addAccount(name: string, owner: 'A' | 'B') {
	const [newAccount] = await db
		.insert(accounts)
		.values({
			name,
			owner
		})
		.returning();
	return newAccount;
}

export async function deleteAccount(id: number) {
	const account = await db.select().from(accounts).where(eq(accounts.id, id)).get();
	if (!account) return null;

	const affectedExpenses = await db.select().from(expenses).where(eq(expenses.accountId, id)).all();

	await db.delete(accounts).where(eq(accounts.id, id)).run();

	return {
		account,
		affectedExpenseIds: affectedExpenses.map(e => e.id)
	};
}

export async function restoreAccount(id: number, name: string, owner: 'A' | 'B', affectedExpenseIds: number[]) {
	await db.insert(accounts).values({ id, name, owner }).run();

	if (affectedExpenseIds.length > 0) {
		for (const expenseId of affectedExpenseIds) {
			await db.update(expenses).set({ accountId: id }).where(eq(expenses.id, expenseId)).run();
		}
	}
}

// 3. Expenses
export async function getActiveExpensesForMonth(year: number, month: number) {
	const targetMonthStr = `${year}-${String(month).padStart(2, '0')}`;
	const targetFirstDay = `${targetMonthStr}-01`;
	const targetLastDay = `${targetMonthStr}-31`;

	// Fetch expenses that are NOT archived or archived after/in the selected month
	const allExpenses = await db
		.select({
			expense: expenses,
			accountName: accounts.name
		})
		.from(expenses)
		.leftJoin(accounts, eq(expenses.accountId, accounts.id))
		.where(
			or(
				isNull(expenses.archivedDate),
				gte(expenses.archivedDate, targetFirstDay)
			)
		)
		.all();

	const activeExpenses: Array<{
		id: number;
		name: string;
		paidBy: 'A' | 'B';
		intervalMonths: number;
		splitType: 'dynamic' | 'static';
		staticSplitRatio: number | null;
		archivedDate: string | null;
		accountId: number | null;
		accountName: string | null;
		amount: number;
		validFrom: string;
		nextPaymentDate: string | null;
	}> = [];

	for (const row of allExpenses) {
		const expense = row.expense;

		// Fetch all amounts for this expense
		const costs = await db
			.select()
			.from(expenseAmounts)
			.where(eq(expenseAmounts.expenseId, expense.id))
			.all();

		if (costs.length === 0) continue;

		// Sort costs by validFrom DESC to find the most relevant one
		// Active cost is the latest cost where validFrom <= targetLastDay
		const activeCost = costs
			.filter(c => c.validFrom <= targetLastDay)
			.sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];

		if (!activeCost) continue; // No cost registered before or in this month

		// Check active based on frequency (intervalMonths)
		const diff = getMonthDiff(activeCost.validFrom, year, month);
		if (diff < 0) continue; // Cost is in the future relative to target month

		let isActive = false;
		if (expense.intervalMonths === 0) {
			// One-time: active only in the specific month of the cost
			isActive = diff === 0;
		} else if (expense.intervalMonths === 1) {
			// Monthly: active in all months after validFrom
			isActive = true;
		} else if (expense.intervalMonths > 1) {
			// Quarterly/yearly etc: active if diff is a multiple of interval
			isActive = diff % expense.intervalMonths === 0;
		}

		if (isActive) {
			// Calculate next payment date if active
			let nextPaymentDate: string | null = null;
			if (expense.intervalMonths > 0) {
				// E.g., if active this month, next is selectedMonth + intervalMonths
				const nextMonthTotal = month + expense.intervalMonths;
				const nextYear = year + Math.floor((nextMonthTotal - 1) / 12);
				const nextMonth = ((nextMonthTotal - 1) % 12) + 1;
				nextPaymentDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
			}

			activeExpenses.push({
				id: expense.id,
				name: expense.name,
				paidBy: expense.paidBy as 'A' | 'B',
				intervalMonths: expense.intervalMonths,
				splitType: expense.splitType as 'dynamic' | 'static',
				staticSplitRatio: expense.staticSplitRatio,
				archivedDate: expense.archivedDate,
				accountId: expense.accountId,
				accountName: row.accountName,
				amount: activeCost.amount,
				validFrom: activeCost.validFrom,
				nextPaymentDate
			});
		}
	}

	return activeExpenses;
}

export async function addExpense(
	name: string,
	paidBy: 'A' | 'B',
	intervalMonths: number,
	splitType: 'dynamic' | 'static',
	staticSplitRatio: number | null,
	accountId: number | null,
	amount: number,
	validFrom: string
) {
	// Insert inside transaction to ensure both expense and amount are created
	const newExpenseId = db.transaction((tx) => {
		const newExpense = tx
			.insert(expenses)
			.values({
				name,
				paidBy,
				intervalMonths,
				splitType,
				staticSplitRatio,
				accountId
			})
			.returning()
			.get();

		tx
			.insert(expenseAmounts)
			.values({
				expenseId: newExpense.id,
				amount,
				validFrom
			})
			.run();

		return newExpense.id;
	});

	return newExpenseId;
}

export async function updateExpenseAmount(expenseId: number, amount: number, validFrom: string) {
	// Update or insert an amount for an expense in the target month.
	// If an amount exists in the same YYYY-MM month, we update its amount.
	// Otherwise, we insert a new amount.
	const targetMonthPrefix = validFrom.substring(0, 7); // e.g. "YYYY-MM"
	const existingCosts = await db
		.select()
		.from(expenseAmounts)
		.where(eq(expenseAmounts.expenseId, expenseId))
		.all();

	const existing = existingCosts
		.filter(c => c.validFrom.startsWith(targetMonthPrefix))
		.sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];

	if (existing) {
		await db
			.update(expenseAmounts)
			.set({ amount })
			.where(eq(expenseAmounts.id, existing.id))
			.run();
	} else {
		await db
			.insert(expenseAmounts)
			.values({
				expenseId,
				amount,
				validFrom
			})
			.run();
	}
}

export async function archiveExpense(expenseId: number, archivedDate: string) {
	await db
		.update(expenses)
		.set({ archivedDate })
		.where(eq(expenses.id, expenseId))
		.run();
}
