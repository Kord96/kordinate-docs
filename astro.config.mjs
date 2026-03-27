// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	server: { port: 4321, host: '0.0.0.0', allowedHosts: 'all' },
	vite: { server: { allowedHosts: true } },
	integrations: [
		starlight({
			title: 'Docs',
			description: 'Project documentation',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/Kord96' }],
			logo: {
				light: './src/assets/logo_light.png',
				dark: './src/assets/logo_dark.png',
			},
			customCss: ['./src/styles/custom.css'],
			sidebar: [
				{
					label: 'Kordinate',
					collapsed: true,
					items: [
						{
							label: 'Architecture',
							items: [
								{ label: 'Overview', slug: 'kordinate/framework/overview' },
								{ label: 'Guards', slug: 'kordinate/framework/guards' },
								{ label: 'Kords', slug: 'kordinate/framework/kords' },
								{ label: 'Recall System', slug: 'kordinate/framework/memory' },
							],
						},
						{
							label: 'Default Team',
							items: [
								{ label: 'Agents', slug: 'kordinate/agents' },
								{ label: 'Scribe', slug: 'kordinate/agents/scribe' },
								{ label: 'Beorn', slug: 'kordinate/agents/beorn' },
								{ label: 'Deployer', slug: 'kordinate/infra/infrastructure' },
								{ label: 'Sauron', slug: 'kordinate/infra/monitoring' },
							],
						},
						{
							label: 'Reference',
							autogenerate: { directory: 'kordinate/reference' },
						},
						{
							label: 'Dev',
							items: [
								{ label: 'Installation', slug: 'kordinate/dev/installation' },
								{ label: 'Sessions & Branches', slug: 'kordinate/dev/sessions' },
								{ label: 'Feature Inventory', slug: 'kordinate/dev/features' },
							],
						},
					],
				},
			],
		}),
	],
});
