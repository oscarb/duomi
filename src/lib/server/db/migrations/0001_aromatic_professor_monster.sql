PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_incomes` (
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`total_income_a` integer,
	`total_income_b` integer,
	PRIMARY KEY(`year`, `month`)
);
--> statement-breakpoint
INSERT INTO `__new_incomes`("year", "month", "total_income_a", "total_income_b") SELECT "year", "month", "total_income_a", "total_income_b" FROM `incomes`;--> statement-breakpoint
DROP TABLE `incomes`;--> statement-breakpoint
ALTER TABLE `__new_incomes` RENAME TO `incomes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;