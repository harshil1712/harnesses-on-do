import { isHarnessId, type HarnessId } from '@harnesses-on-do/shared/config';
import { meteringKey } from '@harnesses-on-do/shared/metering';
import { routeAgentRequest } from 'agents/routing';

export { Metering } from '@harnesses-on-do/shared/metering';
export { Coder } from './harnesses/codex/agent';
export { OpenCodeAgent } from './harnesses/opencode/agent';
export { PiAgent } from './harnesses/pi/agent';
export { SelfModifyingHarnessObject } from './harnesses/self-modifying/agent';
export { ThinkAgent } from './harnesses/think/agent';

/** `/api/metrics/<harness>/<session>`: the session's model calls, as measured by AI Gateway. */
const METRICS = /^\/api\/metrics\/([\w-]+)\/([\w-]+)$/;
/** `/api/<harness>/<rest>`: a harness that runs in its own Worker. */
const EXTERNAL = /^\/api\/([\w-]+)(\/.*)$/;

/** Harnesses that own their build run as their own Worker, behind a service binding. */
function externalWorker(env: Env, harness: HarnessId): Fetcher | undefined {
	switch (harness) {
		case 'flue':
			return env.FLUE;
		case 'nanocode':
			return env.NANOCODE;
		default:
			return undefined;
	}
}

/** Forward a request to a harness Worker, at `path`. */
function forward(worker: Fetcher, request: Request, path: string): Promise<Response> {
	const url = new URL(request.url);
	url.pathname = path;
	return worker.fetch(new Request(url, request));
}

async function metrics(env: Env, request: Request, harness: HarnessId, session: string): Promise<Response> {
	const worker = externalWorker(env, harness);
	if (worker) return forward(worker, request, `/metrics/${session}`);
	const stub = env.Metering.getByName(meteringKey(harness, session));
	return Response.json(await stub.calls());
}

export default {
	async fetch(request, env): Promise<Response> {
		const { pathname } = new URL(request.url);
		try {
			const metricsRoute = METRICS.exec(pathname);
			if (metricsRoute) {
				const [, harness, session] = metricsRoute;
				if (!isHarnessId(harness)) return new Response('Unknown harness', { status: 404 });
				return await metrics(env, request, harness, session);
			}
			const externalRoute = EXTERNAL.exec(pathname);
			const worker = externalRoute && isHarnessId(externalRoute[1]) ? externalWorker(env, externalRoute[1]) : undefined;
			if (externalRoute && worker) return await forward(worker, request, externalRoute[2]);
			return (await routeAgentRequest(request, env)) ?? new Response('Not found', { status: 404 });
		} catch (error) {
			console.error('request failed', error);
			return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;
