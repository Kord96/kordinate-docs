// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
export default defineConfig({
	devToolbar: { enabled: false },
	image: { service: { entrypoint: 'astro/assets/services/noop' } },
	server: { port: 4321, host: '0.0.0.0', allowedHosts: 'all' },
	vite: { server: { allowedHosts: true } },
	integrations: [
		starlight({
			title: 'Docs',
			description: 'Project documentation',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/Kord96' }],
			logo: {
				light: './src/assets/logo_light.webp',
				dark: './src/assets/logo_dark.webp',
			},
			customCss: ['./src/styles/custom.css'],
			head: [
				{
					tag: 'script',
					attrs: { type: 'module' },
					content: `
						import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
						mermaid.initialize({ startOnLoad: false, theme: 'dark' });
						function renderMermaid() {
							document.querySelectorAll('[data-language="mermaid"]').forEach((block, i) => {
								const code = block.querySelector('code') || block;
								if (block.dataset.rendered) return;
								block.dataset.rendered = 'true';
								const pre = block.closest('.expressive-code') || block;
								const div = document.createElement('div');
								div.className = 'mermaid';
								div.textContent = code.textContent;
								pre.replaceWith(div);
							});
							mermaid.run();
						}
						renderMermaid();
						document.addEventListener('astro:page-load', renderMermaid);
					`,
				},
			],
			sidebar: [
				{
					label: 'Kordinate',
					collapsed: true,
					items: [
						{
							label: 'Architecture',
							items: [
								{ label: 'Explorer', link: '/kordinate/' },
							],
						},
						{
							label: 'Default Team',
							items: [
								{ label: 'Agents', link: '/kordinate/agents/' },
								{ label: 'Scribe', link: '/kordinate/agents/scribe/' },
								{ label: 'Beorn', link: '/kordinate/agents/beorn/' },
								{ label: 'Deployer', link: '/kordinate/infra/infrastructure/' },
								{ label: 'Sauron', link: '/kordinate/infra/monitoring/' },
							],
						},
						{
							label: 'Dev',
							items: [
								{ label: 'Installation', link: '/kordinate/dev/installation/' },
								{ label: 'Sessions & Branches', link: '/kordinate/dev/sessions/' },
								{ label: 'Feature Inventory', link: '/kordinate/dev/features/' },
							],
						},
					],
				},
				{
					label: 'Sous Storefront',
					items: [
						{ label: 'Project Explorer', link: '/sous-storefront/' },
					],
				},
				{
					label: 'LogBD',
					items: [
						{ label: 'Project Explorer', link: '/logbd/' },
					],
				},
				{
					label: 'Bookstore APIs',
					items: [
						{ label: 'Project Explorer', link: '/bookstore-apis/' },
					],
				},
			],
		}),
	],
});
