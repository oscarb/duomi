import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import * as fs from 'fs';
import * as path from 'path';

const databaseUrl = process.env.DATABASE_URL || './data/duomi.db';

// Ensure the directory for the SQLite file exists
const dir = path.dirname(databaseUrl);
if (!fs.existsSync(dir)) {
	fs.mkdirSync(dir, { recursive: true });
}

export const sqlite = new Database(databaseUrl);
export const db = drizzle(sqlite, { schema });

// Seed default accounts and income if tables exist and are empty
try {
	const existingAccounts = db.select().from(schema.accounts).all();
	if (existingAccounts.length === 0) {
		const [accA] = db.insert(schema.accounts).values([
			{ name: 'Main Bank Account', owner: 'A' }
		]).returning().all();
		
		db.insert(schema.accounts).values([
			{ name: 'Revolut', owner: 'B' }
		]).run();

		// Seed a default income for the current month so the UI has a nice starting state
		const now = new Date();
		const year = now.getFullYear();
		const month = now.getMonth() + 1;

		db.insert(schema.incomes).values({
			year,
			month,
			totalIncomeA: 4500,
			totalIncomeB: 3000
		}).run();

		// Seed a default expense template (Rent) and its cost
		const [rent] = db.insert(schema.expenses).values({
			name: 'Rent',
			paidBy: 'A',
			intervalMonths: 1,
			splitType: 'dynamic',
			accountId: accA.id
		}).returning().all();

		const yyyymmdd = `${year}-${String(month).padStart(2, '0')}-01`;
		db.insert(schema.expenseCosts).values({
			expenseId: rent.id,
			amount: 2400,
			validFrom: yyyymmdd
		}).run();
	}
} catch (e) {
	// Table might not exist yet during migrations, ignore
}
