import { cloudflare } from '@cloudflare/vite-plugin';
import { flue, flueWorkerConfig } from '@flue/vite';
import { defineConfig } from 'vite';

// Flue owns the build (it generates one Durable Object class per agent), so it
// runs as its own Worker. apps/web reaches it through the FLUE service binding.
export default defineConfig({
	plugins: [flue({ providers: ['cloudflare'] }), cloudflare({ config: flueWorkerConfig(), inspectorPort: 9242 })],
});
