import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { handle } from '../../hooks.server';
import { actions } from './+page.server';
import { env } from '$env/dynamic/private';

function createMockEvent(options: {
	url: string;
	method?: string;
	cookies?: Record<string, string>;
	formData?: Record<string, string>;
}) {
	const url = new URL(options.url);
	const headers = new Headers();
	let body: any = null;

	if (options.formData) {
		headers.set('content-type', 'application/x-www-form-urlencoded');
		const searchParams = new URLSearchParams();
		for (const [key, val] of Object.entries(options.formData)) {
			searchParams.append(key, val);
		}
		body = searchParams.toString();
	}

	const request = new Request(url, {
		method: options.method || 'GET',
		headers,
		body
	});

	const cookieStore = { ...options.cookies };
	const setCookiesCalls: any[] = [];

	const cookies = {
		get(name: string) {
			return cookieStore[name];
		},
		set(name: string, value: string, opts?: any) {
			cookieStore[name] = value;
			setCookiesCalls.push({ name, value, opts });
		},
		delete(name: string, opts?: any) {
			delete cookieStore[name];
		}
	};

	return {
		event: {
			request,
			url,
			cookies,
			route: { id: url.pathname }
		},
		setCookiesCalls
	};
}

describe('Authentication Flow Integration', () => {
	const PASSPHRASE = 'test-master-passphrase';

	beforeEach(() => {
		process.env.SECRET_APP_PASSPHRASE = PASSPHRASE;
		env.SECRET_APP_PASSPHRASE = PASSPHRASE;
	});

	afterEach(() => {
		delete process.env.SECRET_APP_PASSPHRASE;
		delete env.SECRET_APP_PASSPHRASE;
	});



	describe('hooks.server.ts (handle hook)', () => {
		it('should redirect to /login when accessing root "/" without a cookie', async () => {
			const { event } = createMockEvent({ url: 'http://localhost/' });
			const resolve = async () => new Response('OK');

			let error: any = null;
			try {
				await handle({ event, resolve } as any);
			} catch (e) {
				error = e;
			}

			expect(isRedirect(error)).toBe(true);
			if (isRedirect(error)) {
				expect(error.status).toBe(307);
				expect(error.location).toBe('/login');
			}
		});

		it('should redirect to /login when accessing root "/" with an invalid cookie', async () => {
			const { event } = createMockEvent({
				url: 'http://localhost/',
				cookies: { duomi_auth: 'wrong-passphrase' }
			});
			const resolve = async () => new Response('OK');

			let error: any = null;
			try {
				await handle({ event, resolve } as any);
			} catch (e) {
				error = e;
			}

			expect(isRedirect(error)).toBe(true);
			if (isRedirect(error)) {
				expect(error.status).toBe(307);
				expect(error.location).toBe('/login');
			}
		});

		it('should allow access to root "/" when cookie is valid', async () => {
			const { event } = createMockEvent({
				url: 'http://localhost/',
				cookies: { duomi_auth: PASSPHRASE }
			});
			const resolve = async () => new Response('OK');

			const response = await handle({ event, resolve } as any);
			expect(response.status).toBe(200);
			expect(await response.text()).toBe('OK');
		});

		it('should not redirect when accessing /login without a cookie', async () => {
			const { event } = createMockEvent({ url: 'http://localhost/login' });
			const resolve = async () => new Response('OK');

			const response = await handle({ event, resolve } as any);
			expect(response.status).toBe(200);
			expect(await response.text()).toBe('OK');
		});
	});

	describe('login route server actions', () => {
		it('should set secure cookie and redirect to / when correct passphrase is submitted', async () => {
			const { event, setCookiesCalls } = createMockEvent({
				url: 'http://localhost/login',
				method: 'POST',
				formData: { passphrase: PASSPHRASE }
			});

			let error: any = null;
			try {
				await actions.default({
					request: event.request,
					cookies: event.cookies,
					url: event.url
				} as any);
			} catch (e) {
				error = e;
			}

			// Expect a redirect to '/'
			expect(isRedirect(error)).toBe(true);
			if (isRedirect(error)) {
				expect(error.status).toBe(303); // SvelteKit form action redirects are typically 303 See Other
				expect(error.location).toBe('/');
			}

			// Expect duomi_auth cookie to be set correctly
			const authCookie = setCookiesCalls.find(c => c.name === 'duomi_auth');
			expect(authCookie).toBeDefined();
			expect(authCookie.value).toBe(PASSPHRASE);
			expect(authCookie.opts.path).toBe('/');
			expect(authCookie.opts.httpOnly).toBe(true);
		});

		it('should return a form error when incorrect passphrase is submitted', async () => {
			const { event, setCookiesCalls } = createMockEvent({
				url: 'http://localhost/login',
				method: 'POST',
				formData: { passphrase: 'incorrect-passphrase' }
			});

			const result = await actions.default({
				request: event.request,
				cookies: event.cookies,
				url: event.url
			} as any);

			expect(result).toBeDefined();
			// SvelteKit returns validation errors as object with status (e.g. from fail())
			expect(result.status).toBe(400);
			expect(result.data).toBeDefined();
			expect(result.data.incorrect).toBe(true);

			// Cookie should NOT be set
			const authCookie = setCookiesCalls.find(c => c.name === 'duomi_auth');
			expect(authCookie).toBeUndefined();
		});
	});
});
