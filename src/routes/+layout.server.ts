import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/public';

export const load: LayoutServerLoad = () => {
	return {
		personAName: env.PUBLIC_PERSON_A_NAME || 'Partner A',
		personBName: env.PUBLIC_PERSON_B_NAME || 'Partner B'
	};
};
