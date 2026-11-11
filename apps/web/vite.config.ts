import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import agents from 'agents/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		{
			// From the upstream OpenCode example: effect ships the Scalar API reference UI
			// as a script Vite cannot parse; OpenCode never serves it here, so stub it out.
			name: 'empty-httpapi-scalar',
			enforce: 'pre',
			load: (id) => (id.includes('/effect/dist/unstable/httpapi/internal/httpApiScalar.js') ? 'export const javascript = "";' : null),
		},
		agents(),
		react(),
		// Fixed inspector ports, so `pnpm dev` can start every Worker at once.
		cloudflare({ inspectorPort: 9241 }),
		tailwindcss(),
	],
	resolve: {
		// Pi's packages import each other; resolve them all from this app so one
		// version supplies every provider and harness type (as in the upstream example).
		dedupe: [
			'react',
			'react-dom',
			'@earendil-works/chord',
			'@earendil-works/pi-ai',
			'@earendil-works/pi-durable',
			'@earendil-works/pi-telemetry',
		],
	},
});
