## v1.0.0 (2026-06-07)

### config
- configure project scaffolding
- remove preview.allowedHosts from vite.config (was for localtunnel testing)
- update test script to run migrations and ignore CSV files
- ignore TODO.md in git
- add AI agent rules for Scoped Commits and ignore TODO.md

### dashboard
- implement core settlement calculations
- implement main dashboard page
- use inline-grid wrapper for auto-sizing income inputs to fit exact character width
- enforce display: inline-grid on input wrapper to prevent tactile-input styles from breaking layout
- refactor inputs wrapper using inline-flex and absolute positioning to guarantee baseline alignment
- show share button on mobile for settlement
- show nothing to see here when no expenses
- show flat gray split bar when income is zero for both
- increase font weight in incomes share bar
- show full bar if ratio is 100% and set min-width for income share bar
- reduce the margin between all costs and currency symbol
- style month changer arrows as circled buttons
- increase weight of expense names in list
- align expense cost and currency by baseline
- disallow multiple zeros or digits when income starts with zero
- skip rendering literal space in formatToParts to reduce margin between costs and currency
- use celebration icon for all settled state
- make currency margins consistently wider at 4px (mr-1/ml-1)
- increase spacing to mr-2/ml-2 for large fonts in settlement and income inputs
- make expense titles semibold on dashboard
- hide No Account group headers on dashboard and align items left
- fall back dynamic split ratio to latest known month with incomes set
- fallback to last set incomes with light placeholders when current month is empty
- add ToastStore for dismissable success/error notifications with optional actions
- add expense detail overlay with floating sidebar, month navigation, and account management
- update layout, styling, and settlement calculations

### db
- setup database schema and migrations
- create overview and expenses API endpoints
- add multi-month demo mode database seeder under DEMO_MODE=true
- rename expenseCosts to expenseAmounts across schema, migration, and API
- add deleteAccount and restoreAccount queries with undo support
- update queries for exact date amount tracking and expand seeder

### expenses
- implement template manager
- localize expenses manager templates and dynamic inputs
- add translations and currency formatting config unit tests
- format income inputs with dynamic space separators for readability
- make full underline under expense cost hover at the same time
- show frequency instead of split ratio in expenses list
- style expense details title underline to be 50% width and always visible
- center edit pen icon on hover over cost in expense details
- remove calendar icon after since date in expense details
- hide since date for one-time expenses and fix form input names in details sidebar
- add payer badge next to Active badge in details sidebar
- flip the order of static and dynamic options in details sidebar
- increase size of names and percentages in split selector and position closer to slider
- make static split ratio range slider snap easily to even percentages, 33%, and 66%
- style next payment date label and value separately in details sidebar
- increase text size of uppercase headings and labels to text-xs
- format cost in expense details to adhere to thousand separation rules
- make frequency text weight in expenses list less bold
- style cost input underline to match title input (always visible, turns red on hover)
- remove top separator above Paid By in details sidebar
- format since date using short month and year, adjust container size
- style native date pickers and remove since label in edit mode
- format price history date as capitalized month and year
- style range sliders to display share bar colors and white handle with hover scale
- remove icon from account selector buttons in details card
- make title input underline dynamically match text width (max 50% card width)
- convert title to auto-growing textarea supporting wrapping at 50% width and single bottom underline
- use @container and cqw units to ensure title input expands to exactly 50% of card width
- make title input match exact text width and grow up to the cost box margin
- change title input min-width to 1ch to match short titles exactly
- add outline-none focus:outline-none to details card title and amount inputs to prevent browser default outline
- improve cost edit mode alignment, dynamic size-to-digits underline, thousand-grouped formatting, narrower date selector, and vertically centered layout
- make cost input font match display mode font exactly (sans-serif)
- lock cost text position during edit, lower cost underline by 1px, and reduce buttons margin
- restore missing else block for toggling cost edit mode
- fine-tune cost edit row by translating currency up by 3px and shifting digits down/left
- remove padding top 2px from cost edit input
- adjust edit cost input padding and currency alignment
- change cost input padding right to 6px
- align currency symbol horizontally in edit mode
- make share bars consistently start with Person A's color (coral)
- compute next payment date reactively on interval changes
- convert template details into a fixed sliding sidebar with backdrop, mobile transitions, and auto-saving
- add dashboard inline cost editing, style adjustments, and replace paidBy select with move button
- revert sliding sidebar overlay and restore two-column details layout
- remove templateDetails card heading and close button
- revert cost box padding and suffix translate-y to original alignment values
- extract ExpenseFormCard into standalone reusable component
- redesign expenses page with mobile full-screen overlay, floating close button, and rounded card edges
- refactor expense form card and improve management page UI

### i18n
- add translations dictionary and getCurrencyConfig helper for i18n
- read LOCALE and CURRENCY settings on server and inject i18n context client-side
- localize dashboard page and support dynamic currency symbol placement
- add translations for toasts, account management, history, and label refinements
- update terminology to use expense instead of template and add sorting/payer labels

### layout
- setup global layout and styles
- add toast notification container and service worker registration in production

### misc
- Initialize
- Add specification
- Add Modern Web Guidance skill

### pwa
- add docker and service worker support
- improve service worker with network-first strategy and offline cache fallback
- add theme-color meta tag, Apple PWA meta tags, and slide-in animations for PWA experience

### release
- implement semantic release automation script

