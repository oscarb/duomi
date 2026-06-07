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
		dynamic: 'Dynamic',
		static: 'Static',
		paidFrom: 'Paid From',
		noAccount: 'No Account',
		cancel: 'Cancel',
		createTemplate: 'Create Template',
		active: 'Active',
		since: 'since',
		save: 'Save',
		overrideSliderDesc: 'Adjust the slider to override dynamic income-based splitting.',
		source: 'Source',
		addSource: 'Add Source',
		nextPaymentDate: 'Next payment date {date}',
		priceHistory: 'Price History',
		archiveExpense: 'Archive expense',
		saveChanges: 'Save Changes',
		selectTemplate: 'Select a Template',
		selectTemplateDesc: 'Click any expense template on the left to edit its details, ratios, and history, or create a new template.',
		addSourceAccount: 'Add Source Account',
		accountName: 'Account Name',
		owner: 'Owner',
		addAccount: 'Add Account',
		staticSplitRatio: 'Static Split'
	},
	'sv-SE': {
		currentSettlement: 'Aktuell avräkning',
		allSettled: 'Helt reglerat',
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
		detailPaidBy: 'Betalad av',
		frequency: 'Frekvens',
		monthly: 'Månadsvis',
		oneTime: 'Engångs',
		quarterly: 'Kvartalsvis',
		yearly: 'Årlig',
		amountLabel: 'Belopp ({symbol})',
		startMonth: 'Startmånad',
		splitType: 'Delningstyp',
		splittingRatio: 'Delningsandelar',
		dynamic: 'Dynamisk',
		static: 'Statisk',
		paidFrom: 'Betalad från',
		noAccount: 'Inget konto',
		cancel: 'Avbryt',
		createTemplate: 'Skapa mall',
		active: 'Aktiv',
		since: 'sedan',
		save: 'Spara',
		overrideSliderDesc: 'Justera reglaget för att åsidosätta dynamisk inkomstbaserad delning.',
		source: 'Källa',
		addSource: 'Lägg till källa',
		nextPaymentDate: 'Nästa betalningsdatum {date}',
		priceHistory: 'Prishistorik',
		archiveExpense: 'Arkivera utgift',
		saveChanges: 'Spara ändringar',
		selectTemplate: 'Välj en mall',
		selectTemplateDesc: 'Klicka på en utgiftsmall till vänster för att redigera detaljer, andelar och historik, eller skapa en ny mall.',
		addSourceAccount: 'Lägg till betalkonto',
		accountName: 'Kontonamn',
		owner: 'Ägare',
		addAccount: 'Lägg till konto',
		staticSplitRatio: 'Statisk delning'
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
