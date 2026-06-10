import type { Actions } from './$types';

export const actions: Actions = {
	default: async () => {
		return { success: false, incorrect: true };
	}
};
