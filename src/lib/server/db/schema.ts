import { sqliteTable, integer, text, real, primaryKey } from 'drizzle-orm/sqlite-core';

export const incomes = sqliteTable('incomes', {
	year: integer('year').notNull(),
	month: integer('month').notNull(),
	totalIncomeA: integer('total_income_a').notNull().default(0),
	totalIncomeB: integer('total_income_b').notNull().default(0)
}, (table) => ({
	pk: primaryKey({ columns: [table.year, table.month] })
}));

export const accounts = sqliteTable('accounts', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	owner: text('owner').notNull() // 'A' or 'B'
});

export const expenses = sqliteTable('expenses', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	paidBy: text('paid_by').notNull(), // 'A' or 'B'
	intervalMonths: integer('interval_months').notNull().default(1), // 0 = One-time
	splitType: text('split_type').notNull(), // 'dynamic' or 'static'
	staticSplitRatio: real('static_split_ratio'),
	archivedDate: text('archived_date'), // YYYY-MM-DD
	accountId: integer('account_id').references(() => accounts.id, { onDelete: 'set null' })
});

export const expenseAmounts = sqliteTable('expense_amounts', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	expenseId: integer('expense_id').notNull().references(() => expenses.id, { onDelete: 'cascade' }),
	amount: integer('amount').notNull(), // Stored in whole currency units (no decimals)
	validFrom: text('valid_from').notNull() // YYYY-MM-DD
});
