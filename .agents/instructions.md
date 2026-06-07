# Agent Instructions

This project requires strict adherence to commit formatting and file tracking rules.

## Scoped Commits Message Format
Format: `<scope>: <description>` (no types like `feat` or `fix`).
Valid scopes: `db`, `i18n`, `expenses`, `dashboard`, `pwa`, `docker`, `config`, `layout`, `release`, `docs`. New custom scopes may be introduced if a change does not fit any existing scopes (do not shoehorn features into unrelated scopes).

## TODO.md Exclusion
Do not stage or commit `/TODO.md`. It is ignored in `.gitignore`.

## Release script
Always recommend or run `npm run release` to bump the version, compile the changelog, and create a git release tag. Do not manually edit the version number in `package.json`.
