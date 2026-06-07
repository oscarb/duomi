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
		addTemplate: 'Add Template',
		noActiveTemplates: 'No active expense templates for {name}.',
		createNewTemplate: 'Create New Template',
		placeholderExpenseName: 'e.g. Electricity, Groceries',
		expenseName: 'Expense Name',
		name: 'Name',
		detailPaidBy: 'Paid By',
		frequency: 'Frequency',
		monthly: 'Monthly',
		oneTime: 'One-time',
		quarterly: 'Quarterly',
		yearly: 'Yearly',
		amountLabel: 'Amount ({symbol})',
		startMonth: 'Start Month',
		splitType: 'Split Type',
		splittingRatio: 'Splitting Ratio',
		dynamic: 'By Income',
		static: 'Static',
		paidFrom: 'Paid From',
		noAccount: 'No Account',
		cancel: 'Cancel',
		createTemplate: 'Create Template',
		active: 'Active',
		since: 'since',
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
		toastArchived: 'Template archived',
		toastMoved: 'Template moved to {name}',
		archiveExpense: 'Archive expense',
		saveChanges: 'Save Changes',
		selectTemplate: 'Select a Template',
		selectTemplateDesc: 'Click any expense template on the left to edit its details, ratios, and history, or create a new template.',
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
		done: 'Done'
	},
	'sv-SE': {
		currentSettlement: 'Aktuell avräkning',
		allSettled: 'Helt reglerat',
		nothingToSeeHere: 'Här var det tomt',
		noOutstandingExpenses: 'Inga utestående utgifter att dela för denna månad.',
		income: 'Inkomst',
		noIncomeSet: 'Ingen inkomst angiven (50% / 50% delning)',
		expenses: 'Utgifter',
		paidBy: 'BETALAT AV',
		noExpensesPaidBy: 'Inga utgifter betalade av {name} denna månad.',
		addExpense: 'Lägg till utgift',
		copy: 'Kopiera',
		copied: 'Kopierad!',
		share: 'Dela',
		owes: '{payer} är skyldig {receiver} {amount}',
		dashboard: 'Översikt',
		addTemplate: 'Lägg till mall',
		noActiveTemplates: 'Inga aktiva utgiftsmallar för {name}.',
		createNewTemplate: 'Skapa ny mall',
		placeholderExpenseName: 't.ex. El, Matvaror',
		expenseName: 'Namn på utgift',
		name: 'Namn',
		detailPaidBy: 'Betalad av',
		frequency: 'Frekvens',
		monthly: 'Månadsvis',
		oneTime: 'En gång',
		quarterly: 'Kvartalsvis',
		yearly: 'Årlig',
		amountLabel: 'Belopp ({symbol})',
		startMonth: 'Startmånad',
		splitType: 'Delningstyp',
		splittingRatio: 'Fördelning',
		dynamic: 'Efter inkomst',
		static: 'Statisk',
		paidFrom: 'Betalad från',
		noAccount: 'Inget konto',
		cancel: 'Avbryt',
		createTemplate: 'Skapa mall',
		active: 'Aktiv',
		since: 'sedan',
		save: 'Spara',
		hide: 'Dölj',
		overrideSliderDesc: 'Justera reglaget för att åsidosätta dynamisk inkomstbaserad delning.',
		moveTo: 'Flytta till {name}',
		source: 'Konto',
		addSource: 'Lägg till konto',
		nextPaymentDate: 'Nästa betalningsdatum',
		history: 'Historik',
		toastAmountSaved: 'Beloppsändring sparad för {name} från {date}',
		toastCreatedFor: '"{name}" skapad för {date}',
		toastCreatedFrom: '"{name}" skapad från {date}',
		toastArchived: 'Mall arkiverad',
		toastMoved: 'Mall flyttad till {name}',
		archiveExpense: 'Arkivera utgift',
		saveChanges: 'Spara ändringar',
		selectTemplate: 'Välj en mall',
		selectTemplateDesc: 'Klicka på en utgiftsmall till vänster för att redigera detaljer, andelar och historik, eller skapa en ny mall.',
		addSourceAccount: 'Lägg till betalkonto',
		accountName: 'Kontonamn',
		owner: 'Ägare',
		addAccount: 'Lägg till konto',
		staticSplitRatio: 'Statisk delning',
		addNew: 'Lägg till ny',
		jumpToCurrentMonth: 'Gå till aktuell månad',
		toastAccountDeleted: 'Konto "{name}" har raderats',
		toastAccountRestored: 'Konto "{name}" har återställts',
		undo: 'Ångra',
		add: 'Lägg till',
		editAccounts: 'Redigera konton',
		delete: 'Radera',
		archived: 'Arkiverad',
		edit: 'Redigera',
		done: 'Klar'
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
