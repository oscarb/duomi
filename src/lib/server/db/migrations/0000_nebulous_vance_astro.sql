CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`owner` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expense_costs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`expense_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`valid_from` text NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`paid_by` text NOT NULL,
	`interval_months` integer DEFAULT 1 NOT NULL,
	`split_type` text NOT NULL,
	`static_split_ratio` real,
	`archived_date` text,
	`account_id` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `incomes` (
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`total_income_a` integer DEFAULT 0 NOT NULL,
	`total_income_b` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`year`, `month`)
);
