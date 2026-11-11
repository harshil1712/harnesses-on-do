'use agent';
import { env } from 'cloudflare:workers';
import { MODEL_ID, REASONING } from '@harnesses-on-do/shared/config';
import { useModel, useSandbox } from '@flue/runtime';
import { getComputerSandbox } from '../sandboxes/cloudflare-computer';
export { workspaceHost as cloudflare } from '../sandboxes/cloudflare-computer';

/** Flue agent on the Cloudflare target, with a durable Cloudflare Computer workspace. */
export function Assistant() {
	useModel(`cloudflare/${MODEL_ID}`, { thinkingLevel: REASONING });
	useSandbox(getComputerSandbox({ loader: env.LOADER }));
	return 'You are a concise playground assistant. You have a durable workspace at /workspace: use the bash, read, write, edit, grep and glob tools on it. Use tools whenever they can answer the request, and explain their results plainly.';
}
