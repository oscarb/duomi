import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const submittedPassphrase = data.get('passphrase');
		const correctPassphrase = env.SECRET_APP_PASSPHRASE;

		if (!correctPassphrase) {
			throw redirect(303, '/');
		}

		if (submittedPassphrase === correctPassphrase) {
			cookies.set('duomi_auth', correctPassphrase, {
				path: '/',
				httpOnly: true,
				secure: !dev,
				maxAge: 60 * 60 * 24 * 365, // 1 year
				sameSite: 'lax'
			});
			throw redirect(303, '/');
		}

		return fail(400, { incorrect: true });
	}
};
