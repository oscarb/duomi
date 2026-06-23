import { db } from './index';
import { incomes, accounts, expenses, expenseAmounts } from './schema';
import { eq, and, or, isNull, gt, sql, like, inArray } from 'drizzle-orm';

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
		return { year, month, totalIncomeA: null, totalIncomeB: null };
	}

	return result;
}

export async function getLastKnownIncome(person: 'A' | 'B', targetYear: number, targetMonth: number): Promise<number | null> {
	const allIncomes = await db
		.select()
		.from(incomes)
		.all();

	const validIncomes = allIncomes
		.filter(inc => {
			const isBefore = inc.year < targetYear || (inc.year === targetYear && inc.month < targetMonth);
			const val = person === 'A' ? inc.totalIncomeA : inc.totalIncomeB;
			return isBefore && val !== null && val > 0;
		})
		.sort((a, b) => b.year - a.year || b.month - a.month);

	if (validIncomes.length > 0) {
		return person === 'A' ? validIncomes[0].totalIncomeA : validIncomes[0].totalIncomeB;
	}

	return null;
}

export async function getResolvedMonthlyIncomes(year: number, month: number) {
	const income = await getMonthlyIncomes(year, month);
	let incomeA = income.totalIncomeA;
	let incomeB = income.totalIncomeB;
	let isFallbackA = false;
	let isFallbackB = false;

	if (incomeA === null) {
		const fallbackA = await getLastKnownIncome('A', year, month);
		if (fallbackA !== null) {
			incomeA = fallbackA;
			isFallbackA = true;
		} else {
			incomeA = 0;
		}
	}

	if (incomeB === null) {
		const fallbackB = await getLastKnownIncome('B', year, month);
		if (fallbackB !== null) {
			incomeB = fallbackB;
			isFallbackB = true;
		} else {
			incomeB = 0;
		}
	}

	return {
		year,
		month,
		totalIncomeA: incomeA,
		totalIncomeB: incomeB,
		isFallbackA,
		isFallbackB,
		isFallback: isFallbackA && isFallbackB
	};
}

export async function setMonthlyIncome(year: number, month: number, incomeA: number | null, incomeB: number | null) {
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
	return db.select().from(accounts).orderBy(accounts.id).all();
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
// 3. Expenses
export async function getExpensesWithMappedHistory(
	year: number,
	month: number,
	onlyActive = false
) {
	const targetMonthStr = `${year}-${String(month).padStart(2, '0')}`;
	const targetLastDay = `${targetMonthStr}-31`;

	let query = db
		.select({
			expense: expenses,
			accountName: accounts.name
		})
		.from(expenses)
		.leftJoin(accounts, eq(expenses.accountId, accounts.id));

	let dbExpenses;
	if (onlyActive) {
		dbExpenses = await query
			.where(
				or(
					isNull(expenses.archivedDate),
					gt(expenses.archivedDate, targetLastDay)
				)
			)
			.all();
	} else {
		dbExpenses = await query.all();
	}

	const expenseIds = dbExpenses.map(e => e.expense.id);
	const allCosts = expenseIds.length > 0
		? await db
			.select()
			.from(expenseAmounts)
			.where(inArray(expenseAmounts.expenseId, expenseIds))
			.orderBy(expenseAmounts.validFrom)
			.all()
		: [];

	// Group costs by expense ID
	const costsMap: Record<number, typeof allCosts> = {};
	for (const cost of allCosts) {
		if (!costsMap[cost.expenseId]) {
			costsMap[cost.expenseId] = [];
		}
		costsMap[cost.expenseId].push(cost);
	}

	const mappedExpenses = [];

	for (const row of dbExpenses) {
		const expense = row.expense;
		const history = costsMap[expense.id] || [];

		if (history.length === 0) continue;

		// Active cost is the latest cost where validFrom <= targetLastDay
		const activeCost = [...history]
			.filter(c => c.validFrom <= targetLastDay)
			.sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];

		if (onlyActive && !activeCost) continue;

		let isActive = false;
		if (activeCost) {
			const diff = getMonthDiff(activeCost.validFrom, year, month);
			if (diff >= 0) {
				if (expense.intervalMonths === 0) {
					// One-time: active only in the specific month of the cost
					isActive = diff === 0;
				} else if (expense.intervalMonths === 1) {
					// Monthly: active in all months after validFrom
					isActive = true;
				} else if (expense.intervalMonths > 1) {
					// Multi-month intervals: active if diff is a multiple of interval
					isActive = diff % expense.intervalMonths === 0;
				}
			}
		}

		if (onlyActive && !isActive) continue;

		const currentAmount = activeCost ? activeCost.amount : (history[0]?.amount || 0);

		// Calculate next payment date if active
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

		const absoluteLatestCost = history[history.length - 1];

		mappedExpenses.push({
			id: expense.id,
			name: expense.name,
			paidBy: expense.paidBy as 'A' | 'B',
			accountId: expense.accountId,
			accountName: row.accountName,
			intervalMonths: expense.intervalMonths,
			splitType: expense.splitType as 'dynamic' | 'static',
			staticSplitRatio: expense.staticSplitRatio,
			currentAmount: currentAmount,
			amount: currentAmount, // Alias for compatibility with getActiveExpensesForMonth
			latestAmount: absoluteLatestCost ? absoluteLatestCost.amount : currentAmount,
			validFrom: activeCost ? activeCost.validFrom : history[0].validFrom,
			nextPaymentDate,
			archivedDate: expense.archivedDate,
			history: history.map(h => ({
				id: h.id,
				amount: h.amount,
				validFrom: h.validFrom
			}))
		});
	}

	return mappedExpenses;
}

export async function getActiveExpensesForMonth(year: number, month: number) {
	return getExpensesWithMappedHistory(year, month, true);
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
	// Update or insert an amount for an expense on a target date.
	// If an amount exists in the same year and month (YYYY-MM), we update its amount and date.
	// Otherwise, we insert a new amount.
	const targetYearMonth = validFrom.substring(0, 7);
	const existing = await db
		.select()
		.from(expenseAmounts)
		.where(
			and(
				eq(expenseAmounts.expenseId, expenseId),
				like(expenseAmounts.validFrom, `${targetYearMonth}%`)
			)
		)
		.get();

	if (existing) {
		await db
			.update(expenseAmounts)
			.set({ amount, validFrom })
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

export async function unarchiveExpense(expenseId: number) {
	await db
		.update(expenses)
		.set({ archivedDate: null })
		.where(eq(expenses.id, expenseId))
		.run();
}

export async function deleteExpenseAmount(id: number) {
	const amountRecord = await db.select().from(expenseAmounts).where(eq(expenseAmounts.id, id)).get();
	if (!amountRecord) return null;

	// Check if this is the only amount record for the expense
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(expenseAmounts)
		.where(eq(expenseAmounts.expenseId, amountRecord.expenseId))
		.get();

	const count = countResult ? countResult.count : 0;
	if (count <= 1) {
		throw new Error('cannotDeleteOnlyPrice');
	}

	await db.delete(expenseAmounts).where(eq(expenseAmounts.id, id)).run();
	return amountRecord;
}

export async function restoreExpenseAmount(id: number, expenseId: number, amount: number, validFrom: string) {
	await db.insert(expenseAmounts).values({ id, expenseId, amount, validFrom }).run();
}

