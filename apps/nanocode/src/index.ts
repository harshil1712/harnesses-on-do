/**
 * Minimal Nanocode host, after the reference Worker (nanocodexyz/durable-cloudflare):
 * `App.create()` with Workers AI through AI Gateway, and none of its wallets,
 * plans, relays, Python or public rate limits. Not publicly routed: apps/web
 * reaches it through the NANOCODE service binding.
 */
import { App, Gateway } from 'nanocode-ts/cloudflare';
import { GATEWAY_ID, type HarnessId } from '@harnesses-on-do/shared/config';
import { meter, meteringKey, meteringSink, type Metering } from '@harnesses-on-do/shared/metering';
import { traceModelCalls } from '@harnesses-on-do/shared/tracing';

export { Metering } from '@harnesses-on-do/shared/metering';

const HARNESS: HarnessId = 'nanocode';
/** The service binding is the only way in, and apps/web owns the session ids. */
const ACCOUNT = 'harnesses-on-do';
const METRICS = /^\/metrics\/([\w-]+)$/;

type HostEnv = Env & App.Env;

/** The session a model request belongs to, from the dispatch header Nanocode sends its egress. */
function sessionOf(request: Request): string {
	try {
		const dispatch = JSON.parse(request.headers.get('x-nanocode-model') ?? '') as {
			authority?: { session_name?: string; session_id?: string };
		};
		return dispatch.authority?.session_name ?? dispatch.authority?.session_id ?? 'unknown';
	} catch {
		return 'unknown';
	}
}

/** Adds the gateway metadata every harness sends; `Gateway.create` only takes an id. */
function tagged(ai: Ai, session: string): Ai {
	const metadata = JSON.stringify({ harness: HARNESS, session });
	return new Proxy(ai, {
		get(target, prop) {
			if (prop !== 'gateway') return Reflect.get(target, prop, target);
			return (id: string) => {
				const gateway = target.gateway(id);
				return new Proxy(gateway, {
					get(inner, key) {
						if (key !== 'run') return Reflect.get(inner, key, inner);
						return (data: { headers?: Record<string, string> }, options?: unknown) =>
							(inner.run as (...args: unknown[]) => Promise<Response>)(
								{ ...data, headers: { ...data.headers, 'cf-aig-metadata': metadata } },
								options,
							);
					},
				});
			};
		},
	});
}

const nanocode = App.create<HostEnv>({
	authenticate: () => ACCOUNT,
	egress: (env) => ({
		fetch(request) {
			const session = sessionOf(request);
			const metering = env.Metering as unknown as DurableObjectNamespace<Metering>;
			// Nanocode's turns and tools run inside its Wasm engine; its model calls come through here.
			const metered = meter(tagged(env.AI, session), meteringSink(metering, HARNESS, session));
			const ai = traceModelCalls(metered, { name: 'AgentSession', session });
			return Gateway.create(ai, { id: GATEWAY_ID }).fetch(request);
		},
	}),
});

export const { AgentSession } = nanocode;

export default {
	async fetch(request, env): Promise<Response> {
		const metrics = METRICS.exec(new URL(request.url).pathname);
		if (metrics) {
			const metering = env.Metering as unknown as DurableObjectNamespace<Metering>;
			return Response.json(await metering.getByName(meteringKey(HARNESS, metrics[1])).calls());
		}
		return nanocode.fetch(request, env);
	},
} satisfies ExportedHandler<HostEnv>;
