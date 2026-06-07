# Codebase Guidelines - Duomi Expense Tracker

This document serves as the single source of truth for codebase standards, development workflows, and AI rules. All contributors and AI assistants (Cursor, Cline, Claude, Antigravity, etc.) must follow these instructions.

---

## 1. Running the Project & Quality
- **Development Server**: `npm run dev` (starts on port 3001)
- **Production Build**: `npm run build`
- **Preview Production**: `npm run preview`
- **Sync SvelteKit files**: `npx svelte-kit sync` (run this if Vite complains about missing files like `app.html` after file watcher restarts)
- **Type Checking**: `npm run check` (svelte-check with TypeScript config)
- **Unit Tests**: `npm run test` (runs Vitest tests)

---

## 2. Database Setup & Architecture
- **Tech Stack**: Better-SQLite3, Drizzle ORM, Svelte 5.
- **Production Database**: `./data/duomi.db` (SQLite file).
- **Test Database**: `./data/test.db` (isolated to prevent polluting production data). Always verify tests are run with `DATABASE_URL=./data/test.db` (this is configured by default in the `test` script).
- **Database Seeding**: The server automatically seeds mock database values on startup **only** if `process.env.DEMO_MODE === 'true'` and the database tables are empty. If `DEMO_MODE` is unset or false, the database starts as a completely clean slate.
- **Recreating the DB**: To start completely fresh:
  1. Stop the Vite development server.
  2. Delete `./data/duomi.db`.
  3. Run `npx drizzle-kit migrate` to rebuild the schema.
  4. Start the Vite development server again.
  > [!IMPORTANT]
  > Always stop and restart the Vite development server when deleting/re-creating the SQLite database. On Unix/macOS systems, the running Node/Vite process will keep open file descriptors to the unlinked database file, causing it to read/write stale ghost data until restarted.

---

## 3. Svelte 5 State & Reactivity Guidelines
- **Copying Props to Local $state**: Do not use un-guarded `$effect` blocks to copy incoming props to local form/state fields. Because Svelte tracks all accessed signals in an effect, any change in parent data or page invalidations will re-run the effect and reset/wipe out the user's edits.
- **State Protection**: Always use a target tracker (like `currentTargetId = expense ? expense.id : 'new'`) to guard the effect:
  ```typescript
  $effect(() => {
    const targetId = expense ? expense.id : 'new';
    if (currentTargetId !== targetId) {
      currentTargetId = targetId;
      // Initialize states here...
    }
  });
  ```

---

## 4. Translations & Localization
- **Localization Files**: Translations are defined in `src/lib/translations.ts`.
- **Constraint**: For any new text added to the UI, the developer/agent **must** add and maintain matching translations (e.g. for both English `en` and Swedish `sv` locales) rather than hardcoding static strings in components.

---

## 5. Commit Message Standards (Scoped Commits)
We use the **Scoped Commits** specification (https://scopedcommits.com/). All commit messages must be formatted as:
```
<scope>: <description>

[optional body]

[optional trailer(s)]
```

### Valid Scopes
*   `db`: Changes to database schema, migrations, queries, and seeders.
*   `i18n`: Changes to translations and localization helper utilities.
*   `expenses`: Changes to the expenses details page, expense templates, and `ExpenseFormCard.svelte`.
*   `dashboard`: Changes to the main dashboard page, settlement calculations, and incomes management.
*   `pwa`: Changes to the service worker, offline cache strategies, manifest, and PWA integration.
*   `docker`: Changes to `Dockerfile`, `docker-compose.yml`, and `.dockerignore`.
*   `config`: Changes to `package.json` scripts/dependencies, TS config, Vite config, linters, or workspace settings.
*   `layout`: Changes to `app.html`, global `app.css` stylesheet, layout components, and toast notification stores.
*   `release`: Changes to release tooling, versioning scripts, and tags.
*   `docs`: Changes to README, SPEC, design files, or code documentation.
*   **Custom Scopes**: Feel free to introduce new scopes as the codebase grows. Do not shoehorn changes into existing scopes if they do not fit.

### Description Formatting Rules
*   **Case**: Start the description in **lowercase** (e.g. `db: setup database migrations`, NOT `db: Setup database migrations`).
*   **Tense**: Use the **active, present tense** (e.g. `add`, `fix`, `improve`, NOT `added`, `fixed`, `improves`).
*   **Punctuation**: Do **not** end the commit message with a period (`.`).
*   **Conciseness**: Keep the first line under 72 characters.

---

## 6. Handling TODO.md & Releases
*   **Never stage or commit changes to `TODO.md`**: `TODO.md` is ignored in `.gitignore`. It is a local file meant only for tracking your immediate tasks. Keep it completely out of Git commits.
*   **Semantic Versioning Releases**: To bump the project version, generate a changelog, and create a release tag, run:
    ```bash
    npm run release
    ```
    This script is local and zero-dependency, analyzing commits since the last tag and updating `package.json` and `CHANGELOG.md` automatically based on Scoped Commits heuristics. Do not edit `package.json` version strings manually.
