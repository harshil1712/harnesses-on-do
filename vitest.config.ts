import { defineConfig } from 'vitest/config';

// Unit tests for pure modules. Durable Objects and harnesses are verified end to end (see CONTRIBUTING.md).
export default defineConfig({
	test: {
		include: ['apps/*/src/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
	},
});
