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
		currentSettlement: 'Current Settlement',
		allSettled: 'All Settled',
		nothingToSeeHere: 'Nothing to see here',
		noOutstandingExpenses: 'No outstanding expenses to split for this month.',
		income: 'Income',
		noIncomeSet: 'No income set (50% / 50% split)',
		expenses: 'Expenses',
		paidBy: 'PAID BY',
		noExpensesPaidBy: 'No expenses paid by {name} this month.',
		addExpense: 'Add expense',
		copy: 'Copy',
		copied: 'Copied!',
		share: 'Share',
		owes: '{payer} owes {receiver} {amount}',
		dashboard: 'Dashboard',
		addTemplate: 'Add Expense',
		noActiveTemplates: 'No active expenses for {name}.',
		createNewTemplate: 'Create New Expense',
		placeholderExpenseName: 'e.g. Electricity, Groceries',
		expenseName: 'Expense Name',
		name: 'Name',
		detailPaidBy: 'Paid By',
		frequency: 'Frequency',
		monthly: 'Monthly',
		oneTime: 'One-time',
		quarterly: 'Quarterly',
		yearly: 'Yearly',
		frequencyListOneTime: 'One-time',
		frequencyListMonthly: 'monthly',
		frequencyListQuarterly: 'every 3 months',
		frequencyListYearly: 'yearly',
		amountLabel: 'Amount ({symbol})',
		startMonth: 'Start Month',
		splitType: 'Split Type',
		splittingRatio: 'Splitting Ratio',
		dynamic: 'By Income',
		static: 'Static',
		paidFrom: 'Paid From',
		noAccount: 'No Account',
		cancel: 'Cancel',
		createTemplate: 'Create Expense',
		active: 'Active',
		since: 'since',
		from: 'from',
		save: 'Save',
		hide: 'Hide',
		overrideSliderDesc: 'Adjust the slider to override dynamic income-based splitting.',
		moveTo: 'Move to {name}',
		source: 'Account',
		addSource: 'Add Source',
		nextPaymentDate: 'Next payment date',
		history: 'History',
		toastAmountSaved: 'Amount change saved for {name} from {date}',
		toastCreatedFor: '"{name}" created for {date}',
		toastCreatedFrom: '"{name}" created from {date}',
		toastArchived: 'Expense archived',
		toastMoved: '"{name}" moved to {person}',
		archiveExpense: 'Archive expense',
		saveChanges: 'Save Changes',
		selectTemplate: 'Select an Expense',
		selectTemplateDesc: 'Click any expense on the left to edit its details, ratios, and history, or create a new expense.',
		addSourceAccount: 'Add Source Account',
		accountName: 'Account Name',
		owner: 'Owner',
		addAccount: 'Add Account',
		staticSplitRatio: 'Static Split',
		addNew: 'Add new',
		jumpToCurrentMonth: 'Jump to current month',
		toastAccountDeleted: 'Account "{name}" deleted',
		toastAccountRestored: 'Account "{name}" restored',
		undo: 'Undo',
		add: 'Add',
		editAccounts: 'Edit Accounts',
		delete: 'Delete',
		archived: 'Archived',
		edit: 'Edit',
		done: 'Done',
		paidByPerson: 'Paid by {name}',
		toBePaidByPerson: 'To be paid by {name}',
		sortAmount: 'Amount',
		sortTitle: 'Title',
		loginTitle: 'Sign In',
		loginButton: 'Sign In',
		loginPlaceholder: 'Enter master passphrase',
		invalidPassphrase: 'Incorrect passphrase. Please try again.',
		passphraseLabel: 'Passphrase',
		hidePassphrase: 'Hide passphrase',
		showPassphrase: 'Show passphrase'
	},
	'sv-SE': {


		currentSettlement: 'Aktuell balans',

		allSettled: 'Kvitt och klart!',
		nothingToSeeHere: 'Här var det tomt',
		noOutstandingExpenses: 'Inga utgifter att dela den här månaden.',
		income: 'Inkomst',
		noIncomeSet: 'Ingen inkomst inlagd (delas 50/50)',
		expenses: 'Utgifter',
		paidBy: 'BETALAT AV',
		noExpensesPaidBy: 'Inga utgifter betalda av {name} den här månaden.',
		addExpense: 'Lägg till utgift',
		copy: 'Kopiera',
		copied: 'Kopierat!',
		share: 'Dela',
		owes: '{payer} ska betala {receiver} {amount}',
		dashboard: 'Översikt',
		addTemplate: 'Lägg till utgift',
		noActiveTemplates: 'Inga aktiva utgifter för {name}.',
		createNewTemplate: 'Skapa ny utgift',
		placeholderExpenseName: 't.ex. El, Matvaror',
		expenseName: 'Namn på utgiften',
		name: 'Namn',
		detailPaidBy: 'Betald av',
		frequency: 'Hur ofta',
		monthly: 'Månadsvis',
		oneTime: 'En gång',
		quarterly: 'Kvartalsvis',
		yearly: 'Årlig',
		frequencyListOneTime: 'En gång',
		frequencyListMonthly: 'i månaden',
		frequencyListQuarterly: 'i kvartalet',
		frequencyListYearly: 'om året',
		amountLabel: 'Belopp ({symbol})',
		startMonth: 'Startmånad',
		splitType: 'Typ av delning',
		splittingRatio: 'Fördelning',
		dynamic: 'Efter inkomst',
		static: 'Fast',
		paidFrom: 'Betalt från',
		noAccount: 'Inget konto',
		cancel: 'Avbryt',
		createTemplate: 'Skapa utgift',
		active: 'Aktiv',
		since: 'sedan',
		from: 'från',
		save: 'Spara',
		hide: 'Dölj',
		overrideSliderDesc: 'Dra i reglaget för att ändra den automatiska fördelningen.',
		moveTo: 'Flytta till {name}',
		source: 'Konto',
		addSource: 'Lägg till konto',
		nextPaymentDate: 'Nästa betalning',
		history: 'Historik',
		toastAmountSaved: 'Ändrat belopp sparat för {name} från {date}',
		toastCreatedFor: '"{name}" skapades för {date}',
		toastCreatedFrom: '"{name}" skapades från {date}',
		toastArchived: 'Utgiften arkiverad',
		toastMoved: '"{name}" flyttades till {person}',
		archiveExpense: 'Arkivera utgift',
		saveChanges: 'Spara ändringar',
		selectTemplate: 'Välj en utgift',
		selectTemplateDesc: 'Klicka på en utgift till vänster för att ändra detaljer, fördelning och historik, eller skapa en ny utgift.',
		addSourceAccount: 'Lägg till betalkonto',
		accountName: 'Kontonamn',
		owner: 'Ägare',
		addAccount: 'Lägg till konto',
		staticSplitRatio: 'Fast delning',
		addNew: 'Lägg till ny',
		jumpToCurrentMonth: 'Visa den här månaden',
		toastAccountDeleted: 'Kontot "{name}" har raderats',
		toastAccountRestored: 'Kontot "{name}" har återställts',
		undo: 'Ångra',
		add: 'Lägg till',
		editAccounts: 'Ändra konton',
		delete: 'Ta bort',
		archived: 'Arkiverad',
		edit: 'Ändra',
		done: 'Klar',
		paidByPerson: 'Betald av {name}',
		toBePaidByPerson: 'Betalas av {name}',
		sortAmount: 'Belopp',
		sortTitle: 'Titel',
		loginTitle: 'Logga in',
		loginButton: 'Logga in',
		loginPlaceholder: 'Ange lösenordsfras',
		invalidPassphrase: 'Felaktig lösenordsfras. Försök igen.',
		passphraseLabel: 'Lösenordsfras',
		hidePassphrase: 'Dölj lösenordsfras',
		showPassphrase: 'Visa lösenordsfras'
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
