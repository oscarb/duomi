import '../date-mock';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
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

// Automatically run migrations on startup if migrations directory exists
const migrationsFolder = './src/lib/server/db/migrations';
if (fs.existsSync(migrationsFolder)) {
	try {
		migrate(db, { migrationsFolder });
	} catch (e) {
		console.error('Failed to run database migrations:', e);
	}
}

// Seed default accounts and income if tables exist and are empty and DEMO_MODE is true
try {
	const existingAccounts = db.select().from(schema.accounts).all();
	if (existingAccounts.length === 0 && process.env.DEMO_MODE === 'true') {
		const now = new Date();
		const year = now.getFullYear();
		const month = now.getMonth() + 1;

		// Helper to compute past months relative to current date
		const getPastMonth = (y: number, m: number, diff: number) => {
			let newM = m - diff;
			let newY = y;
			while (newM <= 0) {
				newM += 12;
				newY -= 1;
			}
			return { year: newY, month: newM };
		};

		const m2 = getPastMonth(year, month, 2);
		const m1 = getPastMonth(year, month, 1);
		const m0 = { year, month };

		// Seed accounts
		const [accA] = db.insert(schema.accounts).values([
			{ name: 'Main Account (A)', owner: 'A' }
		]).returning().all();

		const [accB] = db.insert(schema.accounts).values([
			{ name: 'Revolut (B)', owner: 'B' }
		]).returning().all();

		// Seed 3 months of incomes
		db.insert(schema.incomes).values([
			{ year: m2.year, month: m2.month, totalIncomeA: 4100, totalIncomeB: 3200 },
			{ year: m1.year, month: m1.month, totalIncomeA: 4300, totalIncomeB: 3100 },
			{ year: m0.year, month: m0.month, totalIncomeA: 4500, totalIncomeB: 3000 }
		]).run();

		// Seed Rent (paid by A, monthly, dynamic)
		const [rent] = db.insert(schema.expenses).values({
			name: 'Rent',
			paidBy: 'A',
			intervalMonths: 1,
			splitType: 'dynamic',
			accountId: accA.id
		}).returning().all();

		db.insert(schema.expenseAmounts).values({
			expenseId: rent.id,
			amount: 2400,
			validFrom: `${m2.year}-${String(m2.month).padStart(2, '0')}-01`
		}).run();

		// Seed Electricity (paid by B, monthly, dynamic, varying prices)
		const [elec] = db.insert(schema.expenses).values({
			name: 'Electricity',
			paidBy: 'B',
			intervalMonths: 1,
			splitType: 'dynamic',
			accountId: accB.id
		}).returning().all();

		db.insert(schema.expenseAmounts).values([
			{ expenseId: elec.id, amount: 120, validFrom: `${m2.year}-${String(m2.month).padStart(2, '0')}-01` },
			{ expenseId: elec.id, amount: 140, validFrom: `${m1.year}-${String(m1.month).padStart(2, '0')}-01` },
			{ expenseId: elec.id, amount: 160, validFrom: `${m0.year}-${String(m0.month).padStart(2, '0')}-01` }
		]).run();

		// Seed Internet (paid by A, monthly, static 50%)
		const [net] = db.insert(schema.expenses).values({
			name: 'Internet',
			paidBy: 'A',
			intervalMonths: 1,
			splitType: 'static',
			staticSplitRatio: 0.5,
			accountId: accA.id
		}).returning().all();

		db.insert(schema.expenseAmounts).values({
			expenseId: net.id,
			amount: 450,
			validFrom: `${m2.year}-${String(m2.month).padStart(2, '0')}-01`
		}).run();

		// Seed Streaming (paid by B, monthly, static 33%)
		const [stream] = db.insert(schema.expenses).values({
			name: 'Streaming',
			paidBy: 'B',
			intervalMonths: 1,
			splitType: 'static',
			staticSplitRatio: 0.33,
			accountId: accB.id
		}).returning().all();

		db.insert(schema.expenseAmounts).values({
			expenseId: stream.id,
			amount: 150,
			validFrom: `${m2.year}-${String(m2.month).padStart(2, '0')}-01`
		}).run();

		// Seed Home Insurance (paid by A, quarterly, dynamic)
		const [ins] = db.insert(schema.expenses).values({
			name: 'Home Insurance',
			paidBy: 'A',
			intervalMonths: 3,
			splitType: 'dynamic',
			accountId: accA.id
		}).returning().all();

		db.insert(schema.expenseAmounts).values({
			expenseId: ins.id,
			amount: 600,
			validFrom: `${m2.year}-${String(m2.month).padStart(2, '0')}-01`
		}).run();

		// Seed Dinner Out (paid by B, one-time, dynamic, valid in Month-1)
		const [dinner] = db.insert(schema.expenses).values({
			name: 'Dinner Out',
			paidBy: 'B',
			intervalMonths: 0,
			splitType: 'dynamic'
		}).returning().all();

		db.insert(schema.expenseAmounts).values({
			expenseId: dinner.id,
			amount: 850,
			validFrom: `${m1.year}-${String(m1.month).padStart(2, '0')}-01`
		}).run();

		// Seed Grocery shopping (paid by A, one-time, dynamic, valid in Current Month)
		const [groceries] = db.insert(schema.expenses).values({
			name: 'Grocery shopping',
			paidBy: 'A',
			intervalMonths: 0,
			splitType: 'dynamic'
		}).returning().all();

		db.insert(schema.expenseAmounts).values({
			expenseId: groceries.id,
			amount: 950,
			validFrom: `${m0.year}-${String(m0.month).padStart(2, '0')}-01`
		}).run();
	}
} catch (e) {
	// Table might not exist yet during migrations, ignore
}
