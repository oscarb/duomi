# Project Specification: Duomi

## 1. Project Overview

**Duomi** is a self-hosted, PWA-optimized web app designed to fairly and proportionally split financial expenses between two people in a household.

- **Philosophy:** Isolated months. Fast data entry. Clear results ("Who pays whom?").
- **Target Audience:** Two specific users. No logins or account management required.
- **Environment:** Built to run as a standalone Docker container on a local network (e.g., on a Synology NAS).
- **Code Management:** Any code published publicly (e.g., on GitHub) must use substitutions (environment variable substitution) instead of hardcoded secrets.

## 2. Tech Stack & AI Guidelines

- **Frontend/Backend:** SvelteKit (Svelte 5). Use _only_ modern Svelte 5 syntax (`$state`, `$derived`, `$props`). Do not use legacy Svelte 4 syntax.
- **Database:** SQLite (a single `.db` file stored in a Docker volume for easy portability and backup).
- **Development Process (TDD):** Vitest. Tests must be written _before_ implementing logic and components.
- **Git:** Atomic commits, single line, keep them short, imperative verbs, don't use scope, start with capital letter.

## 3. Database Schema (SQLite)

The app uses four tables. No built-in date/enum types are used; restrictions are handled via `CHECK` constraints.

```sql
-- Incomes: Manages entered monthly salaries
CREATE TABLE incomes (
    year INTEGER NOT NULL CHECK(year > 2000),
    month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
    total_income_a INTEGER NOT NULL DEFAULT 0,
    total_income_b INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (year, month)
);

-- Accounts: Payment sources (Main Bank Account, Revolut, etc.)
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    owner TEXT NOT NULL CHECK(owner IN ('A', 'B'))
);

-- Expenses: Expense templates
CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    paid_by TEXT NOT NULL CHECK(paid_by IN ('A', 'B')),
    interval_months INTEGER NOT NULL DEFAULT 1 CHECK(interval_months >= 0), -- 0 = One-time
    split_type TEXT NOT NULL CHECK(split_type IN ('dynamic', 'static')),
    static_split_ratio REAL CHECK(static_split_ratio IS NULL OR (static_split_ratio BETWEEN 0.0 AND 1.0)),
    archived_date TEXT, -- YYYY-MM-DD
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL
);

-- Expense Costs: Price history for expenses
CREATE TABLE expense_costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id INTEGER NOT NULL,
    amount INTEGER NOT NULL, -- Stored in whole currency units (no decimals)
    valid_from TEXT NOT NULL, -- YYYY-MM-DD
    FOREIGN KEY(expense_id) REFERENCES expenses(id) ON DELETE CASCADE
);
```

## 4. API Contracts (SvelteKit Server Loaders)

Data is sent pre-calculated from the backend to the frontend to minimize logic in the view layer.
Endpoint: /api/overview (Dashboard)
Returns the settlement and summary for the current month.

```json
{
  "period": { "year": 2026, "month": 8 },
  "settlement": { "payer": "A", "amount": 3250 },
  "income": {
    "total": 55500,
    "person_a": { "amount": 31000, "percentage": 0.56 },
    "person_b": { "amount": 24500, "percentage": 0.44 }
  },
  "expenses": {
    "total": 18500,
    "items": [
      {
        "id": 1,
        "name": "Rent",
        "amount": 9500,
        "paid_by": "A",
        "split_type": "dynamic",
        "split_ratio": 0.56,
        "account": "Main Bank Account"
      }
    ]
  }
}
```

**Endpoint:** /api/expenses (Expenses/Templates)
Returns all active templates as well as necessary metadata (global dynamic ratio and available accounts).

```json
{
  "dynamic_split_ratio_a": 0.56,
  "expenses": [
    {
      "id": 1,
      "name": "Rent",
      "paid_by": "A",
      "account_id": 1,
      "interval_months": 1,
      "split_type": "dynamic",
      "static_split_ratio": 0.5,
      "current_amount": 9500,
      "next_payment_date": "2026-09-01",
      "archived_date": null,
      "history": [{ "amount": 9500, "valid_from": "2026-08-01" }]
    }
  ],
  "accounts": [{ "id": 1, "name": "Main Bank Account", "owner": "A" }]
}
```
