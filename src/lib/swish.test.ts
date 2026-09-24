import { describe, it, expect } from 'vitest';
import { buildSwishUrl, getSettlementRecipientSwish } from './swish';

describe('buildSwishUrl', () => {
	it('generates the exact Swish link format matching specification', () => {
		const url = buildSwishUrl({
			phone: '073712345678',
			amount: 100,
			monthName: 'September',
			year: 2026
		});
		expect(url).toBe('https://app.swish.nu/1/p/sw/?sw=073712345678&amt=100&cur=SEK&msg=September%202026');
	});

	it('cleans spaces and dashes from phone numbers', () => {
		const url = buildSwishUrl({
			phone: '073-712 34 56',
			amount: 250,
			monthName: 'Oktober',
			year: 2026
		});
		expect(url).toBe('https://app.swish.nu/1/p/sw/?sw=0737123456&amt=250&cur=SEK&msg=Oktober%202026');
	});

	it('rounds decimal amounts to the nearest whole integer', () => {
		const url = buildSwishUrl({
			phone: '0701234567',
			amount: 149.6,
			monthName: 'Mars',
			year: 2026
		});
		expect(url).toBe('https://app.swish.nu/1/p/sw/?sw=0701234567&amt=150&cur=SEK&msg=Mars%202026');
	});

	it('properly URI-encodes special characters in localized month names', () => {
		const url = buildSwishUrl({
			phone: '+46737123456',
			amount: 75,
			monthName: 'Maj',
			year: 2026
		});
		expect(url).toBe('https://app.swish.nu/1/p/sw/?sw=%2B46737123456&amt=75&cur=SEK&msg=Maj%202026');
	});
});

describe('getSettlementRecipientSwish', () => {
	it('returns Person B swish when Person A is the payer (A owes B)', () => {
		const result = getSettlementRecipientSwish('A', '0701111111', '0702222222');
		expect(result).toBe('0702222222');
	});

	it('returns Person A swish when Person B is the payer (B owes A)', () => {
		const result = getSettlementRecipientSwish('B', '0701111111', '0702222222');
		expect(result).toBe('0701111111');
	});

	it('returns empty string if receiver has no swish number defined', () => {
		// A owes B, but B has no number
		expect(getSettlementRecipientSwish('A', '0701111111', '')).toBe('');
		expect(getSettlementRecipientSwish('A', '0701111111', null)).toBe('');
		expect(getSettlementRecipientSwish('A', '0701111111', undefined)).toBe('');

		// B owes A, but A has no number
		expect(getSettlementRecipientSwish('B', '', '0702222222')).toBe('');
		expect(getSettlementRecipientSwish('B', null, '0702222222')).toBe('');
	});

	it('returns receiver number even if the payer has no number defined', () => {
		// A owes B: B has number, A does not
		expect(getSettlementRecipientSwish('A', '', '0702222222')).toBe('0702222222');

		// B owes A: A has number, B does not
		expect(getSettlementRecipientSwish('B', '0701111111', '')).toBe('0701111111');
	});

	it('returns empty string if payer is null (all settled)', () => {
		expect(getSettlementRecipientSwish(null, '0701111111', '0702222222')).toBe('');
	});
});
