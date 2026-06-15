import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';

const DEFAULT_CURRENCIES: Record<string, string> = {
	'sv-SE': 'SEK',
	'en-US': 'USD'
};

export const load: LayoutServerLoad = ({ url }) => {
	const locale = url.searchParams.get('test_locale') || privateEnv.LOCALE || 'en-US';
	const currency = url.searchParams.get('test_currency') || privateEnv.CURRENCY || DEFAULT_CURRENCIES[locale] || 'USD';

	return {
		personAName: env.PUBLIC_PERSON_A_NAME || 'Partner A',
		personBName: env.PUBLIC_PERSON_B_NAME || 'Partner B',
		locale,
		currency
	};
};
