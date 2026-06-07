import { describe, it, expect } from 'vitest';
import { translate, getCurrencyConfig } from './translations';

describe('translate', () => {
	it('should fall back to English translations for unknown locales', () => {
		const text = translate('fr-FR', 'income');
		expect(text).toBe('Income');
	});

	it('should return the key itself if the key is not in translations at all', () => {
		const text = translate('en-US', 'non_existent_key_123');
		expect(text).toBe('non_existent_key_123');
	});

	it('should return Swedish translation when locale is sv-SE', () => {
		const text = translate('sv-SE', 'income');
		expect(text).toBe('Inkomst');
	});

	it('should perform placeholder substitutions correctly', () => {
		const text = translate('en-US', 'owes', {
			payer: 'Charlie',
			receiver: 'Delta',
			amount: '$100'
		});
		expect(text).toBe('Charlie owes Delta $100');
	});

	it('should perform placeholder substitutions correctly for Swedish', () => {
		const text = translate('sv-SE', 'owes', {
			payer: 'Charlie',
			receiver: 'Delta',
			amount: '100 kr'
		});
		expect(text).toBe('Charlie är skyldig Delta 100 kr');
	});

	it('should translate correctly for other common keys', () => {
		expect(translate('en-US', 'createNewTemplate')).toBe('Create New Expense');
		expect(translate('sv-SE', 'createNewTemplate')).toBe('Skapa ny utgift');
		
		expect(translate('en-US', 'placeholderExpenseName')).toBe('e.g. Electricity, Groceries');
		expect(translate('sv-SE', 'placeholderExpenseName')).toBe('t.ex. El, Matvaror');
	});
});

describe('getCurrencyConfig', () => {
	it('should correctly configure USD as a prefix symbol for en-US', () => {
		const config = getCurrencyConfig('en-US', 'USD');
		expect(config.symbol).toBe('$');
		expect(config.isPrefix).toBe(true);
	});

	it('should correctly configure SEK as a suffix symbol for sv-SE', () => {
		const config = getCurrencyConfig('sv-SE', 'SEK');
		// Depending on node environment version, it can format to "kr" or "kr." or similar
		// We expect "kr" (contains "kr") and to be suffix
		expect(config.symbol).toContain('kr');
		expect(config.isPrefix).toBe(false);
	});

	it('should gracefully fallback to default values on error/invalid input', () => {
		const config = getCurrencyConfig('invalid-locale', 'INVALID-CURRENCY');
		expect(config.symbol).toBe('$');
		expect(config.isPrefix).toBe(true);
	});
});
