// @ts-check
import { defineConfig } from 'astro/config';
import devAuthPlugin from './vite-auth-plugin.ts';

export default defineConfig({
	devToolbar: { enabled: false },
	base: '/dev',
	server: { port: 4321, host: '0.0.0.0', allowedHosts: 'all' },
	vite: {
		server: { allowedHosts: true },
		plugins: [devAuthPlugin()],
	},
});
