export interface CurrencyConfig {
	symbol: string;
	isPrefix: boolean;
}

export function getCurrencyConfig(locale: string, currency: string): CurrencyConfig {
	try {
		const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 });
		const parts = formatter.formatToParts(1);
		const currencyPart = parts.find(p => p.type === 'currency');
		const symbol = currencyPart ? currencyPart.value : '$';

		const currencyIndex = parts.findIndex(p => p.type === 'currency');
		const integerIndex = parts.findIndex(p => p.type === 'integer');
		const isPrefix = currencyIndex < integerIndex;

		return { symbol, isPrefix };
	} catch (e) {
		return { symbol: '$', isPrefix: true };
	}
}

export const translations: Record<string, Record<string, string>> = {
	'en-US': {
		// Common UI Actions & States
		name: 'Name',
		add: 'Add',
		edit: 'Edit',
		save: 'Save',
		delete: 'Delete',
		cancel: 'Cancel',
		done: 'Done',
		undo: 'Undo',
		share: 'Share',
		copy: 'Copy',
		copied: 'Copied!',
		from: 'from',
		since: 'since',

		// Dashboard & Settlement
		dashboard: 'Dashboard',
		expenses: 'Expenses',
		income: 'Income',
		jumpToCurrentMonth: 'Jump to {currentDate}',
		currentSettlement: 'Current Settlement',
		allSettled: 'All Settled',
		noOutstandingExpenses: 'No outstanding expenses to split for this month.',
		paidByPerson: 'Paid by {name}',
		toBePaidByPerson: 'To be paid by {name}',
		owes: '{amount}',
		nothingToSeeHere: 'Nothing to see here',

		// Expense Management & Form
		addExpense: 'Add expense',
		editAccounts: 'Edit accounts',
		accountName: 'Account name',
		placeholderAccountName: 'e.g. Main Bank, Revolut',
		source: 'Account',
		frequency: 'Frequency',
		monthly: 'Monthly',
		quarterly: 'Quarterly',
		yearly: 'Yearly',
		oneTime: 'One time',
		frequencyListMonthly: 'monthly',
		frequencyListQuarterly: 'every 3 months',
		frequencyListYearly: 'yearly',
		frequencyListOneTime: 'One-time',
		splittingRatio: 'Splitting Ratio',
		dynamic: 'By Income',
		static: 'Custom',
		comparisonPrice: 'Per month',
		yearlyComparisonPrice: 'Per year',
		predictedAmount: 'Predicted: {amount} (approx. {date})',
		nextPayment: 'Next payment',
		moveTo: 'Move to {name}',
		noActiveTemplates: 'No active expenses for {name}.',
		archiveExpense: 'End expense',
		archived: 'Ended',
		history: 'History',
		cannotDeleteOnlyPrice: 'Cannot delete the only remaining price entry',
		active: 'Active',

		// Expense Filters & Sorting
		allAccounts: 'All accounts',
		allTypes: 'All types',
		noTypes: 'No types',
		typeRecurring: 'Recurring',
		typeOneTime: 'One-time',
		typeArchived: 'Ended',
		sortTitle: 'Name',
		sortAmount: 'Amount',
		sortAscending: 'Ascending',
		sortDescending: 'Descending',

		// Toast Notifications
		toastCreatedFor: 'Added {name} for {date}',
		toastCreatedFrom: '{name} added from {date}',
		toastAmountSaved: '{name} updated to {amount} from {date}',
		toastArchived: 'Expense ended',
		toastMoved: '"{name}" moved to {person}',
		toastHistoryDeleted: 'Price history for {date} deleted',
		toastHistoryRestored: 'Price history for {date} restored',
		toastAccountDeleted: 'Account {name} deleted',
		toastAccountRestored: 'Account {name} restored',

		// Authentication
		passphraseLabel: 'Passphrase',
		loginPlaceholder: 'Enter master passphrase',
		loginButton: 'Sign In',
		invalidPassphrase: 'Incorrect passphrase. Please try again.',
		showPassphrase: 'Show passphrase',
		hidePassphrase: 'Hide passphrase'
	},
	'sv-SE': {
		// Common UI Actions & States
		name: 'Namn',
		add: 'Lägg till',
		edit: 'Redigera',
		save: 'Spara',
		delete: 'Radera',
		cancel: 'Avbryt',
		done: 'Klar',
		undo: 'Ångra',
		share: 'Dela',
		copy: 'Kopiera',
		copied: 'Kopierad!',
		from: 'från',
		since: 'sedan',

		// Dashboard & Settlement
		dashboard: 'Översikt',
		expenses: 'Utgifter',
		income: 'Inkomst',
		jumpToCurrentMonth: 'Gå till {currentDate}',
		currentSettlement: 'Att göra upp om',
		allSettled: 'Inget att göra upp om',
		noOutstandingExpenses: 'Inga utgifter att dela denna månad.',
		paidByPerson: 'Betalat av {name}',
		toBePaidByPerson: 'Betalas av {name}',
		owes: '{amount}',
		nothingToSeeHere: 'Här var det tomt',

		// Expense Management & Form
		addExpense: 'Lägg till utgift',
		editAccounts: 'Redigera konton',
		accountName: 'Kontonamn',
		placeholderAccountName: 't.ex. Lönekonto, Revolut',
		source: 'Konto',
		frequency: 'Frekvens',
		monthly: 'Månad',
		quarterly: 'Kvartal',
		yearly: 'År',
		oneTime: 'En gång',
		frequencyListMonthly: 'i månaden',
		frequencyListQuarterly: 'i kvartalet',
		frequencyListYearly: 'om året',
		frequencyListOneTime: 'En gång',
		splittingRatio: 'Fördelning',
		dynamic: 'Efter inkomst',
		static: 'Egen',
		comparisonPrice: 'Per månad',
		yearlyComparisonPrice: 'Per år',
		predictedAmount: 'Prognos: {amount} (ca {date})',
		nextPayment: 'Nästa betalning',
		moveTo: 'Flytta till {name}',
		noActiveTemplates: 'Inga aktiva utgifter för {name}.',
		archiveExpense: 'Avsluta utgift',
		archived: 'Avslutad',
		history: 'Historik',
		cannotDeleteOnlyPrice: 'Kan inte radera det enda kvarvarande priset',
		active: 'Aktiv',

		// Expense Filters & Sorting
		allAccounts: 'Alla konton',
		allTypes: 'Alla typer',
		noTypes: 'Inga typer',
		typeRecurring: 'Regelbundna',
		typeOneTime: 'Engångs',
		typeArchived: 'Avslutade',
		sortTitle: 'Namn',
		sortAmount: 'Belopp',
		sortAscending: 'Stigande',
		sortDescending: 'Fallande',

		// Toast Notifications
		toastCreatedFor: 'Lagt till {name} för {date}',
		toastCreatedFrom: '{name} tillagt från {date}',
		toastAmountSaved: '{name} ändrat till {amount} från {date}',
		toastArchived: 'Utgift avslutad',
		toastMoved: '"{name}" flyttad till {person}',
		toastHistoryDeleted: 'Prishistorik för {date} raderad',
		toastHistoryRestored: 'Prishistorik för {date} återställd',
		toastAccountDeleted: 'Kontot {name} har raderats',
		toastAccountRestored: 'Kontot {name} har återställts',

		// Authentication
		passphraseLabel: 'Lösenordsfras',
		loginPlaceholder: 'Ange lösenordsfras',
		loginButton: 'Logga in',
		invalidPassphrase: 'Fel lösenord. Försök igen.',
		showPassphrase: 'Visa lösenordsfras',
		hidePassphrase: 'Dölj lösenordsfras'
	}
};

export function translate(locale: string, key: string, params?: Record<string, string>): string {
	const dict = translations[locale] || translations['en-US'];
	let text = dict[key] || translations['en-US'][key] || key;
	if (params) {
		Object.entries(params).forEach(([k, v]) => {
			text = text.replace(`{${k}}`, v);
		});
	}
	return text;
}
