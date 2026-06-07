/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

const CACHE = `cache-${version}`;
const ASSETS = [...build, ...files];

self.addEventListener('install', (event: any) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => {
				(self as any).skipWaiting();
			})
	);
});

self.addEventListener('activate', (event: any) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			for (const key of keys) {
				if (key !== CACHE) await caches.delete(key);
			}
			await (self as any).clients.claim();
		})
	);
});

self.addEventListener('fetch', (event: any) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	const isHttp = url.protocol.startsWith('http');
	const isLocal = url.hostname === self.location.hostname;

	if (isHttp && isLocal) {
		event.respondWith(
			caches.match(event.request).then((cachedResponse) => {
				if (cachedResponse) {
					return cachedResponse;
				}
				return fetch(event.request).then((response) => {
					// Don't cache dynamic API endpoints, only SvelteKit pages
					if (!url.pathname.startsWith('/api') && response.status === 200) {
						const responseCopy = response.clone();
						caches.open(CACHE).then((cache) => {
							cache.put(event.request, responseCopy);
						});
					}
					return response;
				});
			})
		);
	}
});
