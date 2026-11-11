/**
 * Agent traces for harnesses that do not trace themselves, after
 * developers.cloudflare.com/agents/runtime/observability/tracing/#custom-harnesses:
 * an `invoke_agent` span per turn, with `chat` spans for model calls and
 * `execute_tool` spans for tool runs. Spans nest by async context.
 */
import { tracing } from 'cloudflare:workers';

/** Who a span belongs to, for the Agents dashboard. */
export type AgentIdentity = { readonly name: string; readonly session: string };

function identityAttributes({ name, session }: AgentIdentity) {
	return { 'gen_ai.agent.name': name, 'gen_ai.agent.id': session, 'gen_ai.conversation.id': session };
}

function fail(span: Span, error: unknown): void {
	span.setStatus({ code: 'error', message: error instanceof Error ? error.message : String(error) });
}

/** An `invoke_agent` span around one turn. */
export function traceTurn<T>(identity: AgentIdentity, run: () => Promise<T>): Promise<T> {
	return tracing.enterSpan(`invoke_agent ${identity.name}`, async (span) => {
		span.setAttributes({ ...identityAttributes(identity), 'gen_ai.operation.name': 'invoke_agent' });
		try {
			return await run();
		} catch (error) {
			fail(span, error);
			throw error;
		}
	});
}

/** An `execute_tool` span around one tool run. */
export function traceTool<T>(call: { id?: string; name: string }, run: () => Promise<T>): Promise<T> {
	return tracing.enterSpan(`execute_tool ${call.name}`, async (span) => {
		span.setAttributes({ 'gen_ai.operation.name': 'execute_tool', 'gen_ai.tool.name': call.name, 'gen_ai.tool.call.id': call.id });
		try {
			return await run();
		} catch (error) {
			fail(span, error);
			throw error;
		}
	});
}

/** The last token counts in a model response, streamed or not. */
export function usageOf(text: string): { input?: number; output?: number } {
	const last = (key: string) => {
		const matches = [...text.matchAll(new RegExp(`"${key}":\\s*(\\d+)`, 'g'))];
		return matches.length > 0 ? Number(matches[matches.length - 1][1]) : undefined;
	};
	return { input: last('prompt_tokens') ?? last('input_tokens'), output: last('completion_tokens') ?? last('output_tokens') };
}

/** The same response, ending `span` with its token usage once the body has been read. */
function endWithResponse(span: Span, response: Response): Response {
	const end = (text: string) => {
		const usage = usageOf(text);
		span.setAttributes({ 'gen_ai.usage.input_tokens': usage.input, 'gen_ai.usage.output_tokens': usage.output });
		span.end();
	};
	if (!response.body) {
		span.end();
		return response;
	}
	// Usage comes at the end of a stream, so keep only its tail.
	const decoder = new TextDecoder();
	let tail = '';
	const body = response.body.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				controller.enqueue(chunk);
				tail = (tail + decoder.decode(chunk, { stream: true })).slice(-4096);
			},
			flush: () => end(tail),
		}),
	);
	return new Response(body, response);
}

function traceChat(identity: AgentIdentity, model: string | undefined, call: () => Promise<unknown>): Promise<unknown> {
	return tracing.startActiveSpan(model ? `chat ${model}` : 'chat', async (span) => {
		span.setAttributes({
			...identityAttributes(identity),
			'gen_ai.operation.name': 'chat',
			'gen_ai.provider.name': 'cloudflare',
			'gen_ai.request.model': model,
		});
		try {
			const result = await call();
			if (!(result instanceof Response)) {
				span.end();
				return result;
			}
			span.setAttribute('cloudflare.ai_gateway.log.id', result.headers.get('cf-aig-log-id') ?? '');
			return endWithResponse(span, result);
		} catch (error) {
			fail(span, error);
			span.end();
			throw error;
		}
	});
}

/** The `AI` binding, with a `chat` span around each `run()` and `gateway().run()`. */
export function traceModelCalls(ai: Ai, identity: AgentIdentity): Ai {
	const traceGateway = (gateway: AiGateway): AiGateway =>
		new Proxy(gateway, {
			get(target, prop) {
				if (prop === 'run') {
					return (...args: Parameters<AiGateway['run']>) => {
						const request = Array.isArray(args[0]) ? args[0][0] : args[0];
						const model = (request?.query as { model?: string } | undefined)?.model;
						return traceChat(identity, model, () => target.run(...args));
					};
				}
				const value = Reflect.get(target, prop, target);
				return typeof value === 'function' ? value.bind(target) : value;
			},
		});

	return new Proxy(ai, {
		get(target, prop) {
			if (prop === 'run') {
				return (model: string, ...rest: unknown[]) =>
					traceChat(identity, model, () => (target.run as (...a: unknown[]) => Promise<unknown>)(model, ...rest));
			}
			if (prop === 'gateway') return (id: string) => traceGateway(target.gateway(id));
			const value = Reflect.get(target, prop, target);
			return typeof value === 'function' ? value.bind(target) : value;
		},
	});
}
