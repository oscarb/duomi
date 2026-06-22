import './lib/server/date-mock';
import { redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const handle: Handle = async ({ event, resolve }) => {
	const passphrase = env.SECRET_APP_PASSPHRASE;

	if (passphrase) {
		const cookie = event.cookies.get('duomi_auth');
		const isLoginPath = event.url.pathname === '/login';
		const isAsset = event.url.pathname.startsWith('/_app/') || event.url.pathname.includes('.');

		if (cookie !== passphrase && !isLoginPath && !isAsset) {
			throw redirect(307, '/login');
		}
	}

	return resolve(event);
};
