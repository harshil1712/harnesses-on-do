import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: [
			// Copied from upstream projects (see THIRD_PARTY_NOTICES.md).
			'**/upstream/**',
			'apps/flue/src/sandboxes/cloudflare-computer.ts',
			'apps/web/codex-kernel/**',
			// Generated
			'**/env.d.ts',
			'**/dist/**',
			'**/.flue-vite/**',
			'**/.wrangler/**',
		],
	},
	js.configs.recommended,
	tseslint.configs.recommended,
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: { globals: { ...globals.browser, ...globals.worker } },
		rules: {
			'@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
		},
	},
	{
		files: ['apps/web/src/client/**/*.{ts,tsx}', 'apps/web/src/harnesses/**/use-*.ts'],
		plugins: { 'react-hooks': reactHooks },
		rules: reactHooks.configs.recommended.rules,
	},
);
