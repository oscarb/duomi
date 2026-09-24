import { describe, it, expect } from 'vitest';
import { load } from './+layout.server';

describe('+layout.server load', () => {
	it('loads default names and empty swish numbers when no env or params are set', () => {
		const url = new URL('http://localhost:3000/');
		const result = load({ url } as any);
		expect(result).toMatchObject({
			personAName: 'Partner A',
			personBName: 'Partner B',
			personASwish: '',
			personBSwish: '',
			locale: 'en-US',
			currency: 'USD'
		});
	});

	it('respects URL test query parameters for swish numbers and names', () => {
		const url = new URL('http://localhost:3000/?test_person_a=Alice&test_person_b=Bob&test_person_a_swish=0731112233&test_person_b_swish=0734445566');
		const result = load({ url } as any);
		expect(result).toMatchObject({
			personAName: 'Alice',
			personBName: 'Bob',
			personASwish: '0731112233',
			personBSwish: '0734445566'
		});
	});
});
