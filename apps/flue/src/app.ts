import { env } from 'cloudflare:workers';
import { setProvider } from '@flue/runtime';
import { getDurableObjectIdentity } from '@flue/runtime/cloudflare';
import { cloudflareBindingProvider } from '@flue/runtime/cloudflare/workers-ai';
import { createAgentRouter } from '@flue/runtime/routing';
import { GATEWAY_ID, type HarnessId } from '@harnesses-on-do/shared/config';
import { meter, meteringKey, meteringSink, type Metering } from '@harnesses-on-do/shared/metering';
import { Hono } from 'hono';
import { Assistant } from './agents/assistant';

const HARNESS: HarnessId = 'flue';
// Flue owns the Worker entry, so `wrangler types` cannot see the class behind this binding.
const METERING = env.Metering as unknown as DurableObjectNamespace<Metering>;

/**
 * Workers AI through the shared gateway, metered like every other harness.
 * Providers register once per isolate, so the conversation is resolved per call.
 */
const ai = new Proxy(env.AI, {
	get(target, prop) {
		if (prop !== 'run') return Reflect.get(target, prop, target);
		return (model: string, inputs: unknown, options: AiOptions = {}) => {
			const session = getDurableObjectIdentity().name;
			const metered = meter(target, meteringSink(METERING, HARNESS, session));
			const gateway = { ...options.gateway, id: GATEWAY_ID, metadata: { ...options.gateway?.metadata, harness: HARNESS, session } };
			return (metered.run as (...args: unknown[]) => Promise<unknown>)(model, inputs, { ...options, gateway });
		};
	},
});
setProvider(cloudflareBindingProvider({ binding: ai, gateway: { id: GATEWAY_ID } }));

const app = new Hono();
app.route('/agents/assistant', createAgentRouter(Assistant));
app.get('/metrics/:session', async (c) => {
	const stub = METERING.getByName(meteringKey(HARNESS, c.req.param('session')));
	return c.json(await stub.calls());
});

export default app;
