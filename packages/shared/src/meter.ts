/**
 * `meter()` wraps a harness's `AI` binding and reports the AI Gateway log id
 * of each model call it makes. The `Metering` Durable Object (./metering.ts)
 * resolves those ids into gateway-measured tokens, cost and duration.
 *
 * This module has no Workers runtime imports, so it runs in unit tests.
 */

export type OfferedTool = { readonly name: string; readonly description: string };
export type RecordedCall = {
	readonly logId: string;
	readonly startedAt: number;
	/** The tools the request offered the model. */
	readonly tools?: readonly OfferedTool[];
};
export type CallSink = (call: RecordedCall) => void;

/** The tools a model request offers: OpenAI chat (`{ function: { name } }`), Responses or Workers AI (`{ name }`) form. */
export function toolsOf(request: unknown): OfferedTool[] | undefined {
	const tools = (request as { tools?: unknown } | undefined)?.tools;
	if (!Array.isArray(tools)) return undefined;
	return tools.flatMap((tool: { name?: unknown; description?: unknown; function?: { name?: unknown; description?: unknown } }) => {
		const name = tool.function?.name ?? tool.name;
		const description = tool.function?.description ?? tool.description;
		return typeof name === 'string' ? [{ name, description: typeof description === 'string' ? description : '' }] : [];
	});
}

function logIdOf(result: unknown, fallback: string | null): string | null {
	if (result instanceof Response) return result.headers.get('cf-aig-log-id') ?? fallback;
	return fallback;
}

/** The `AI` binding, recording every `run()` and `gateway().run()` it makes. */
export function meter(ai: Ai, sink: CallSink): Ai {
	const wrapGateway = (gateway: AiGateway): AiGateway =>
		new Proxy(gateway, {
			get(target, prop) {
				if (prop === 'run') {
					return async (...args: Parameters<AiGateway['run']>) => {
						const startedAt = Date.now();
						const response = await target.run(...args);
						const logId = response.headers.get('cf-aig-log-id');
						const request = Array.isArray(args[0]) ? args[0][0] : args[0];
						if (logId) sink({ logId, startedAt, tools: toolsOf(request?.query) });
						return response;
					};
				}
				const value = Reflect.get(target, prop, target);
				return typeof value === 'function' ? value.bind(target) : value;
			},
		});

	return new Proxy(ai, {
		get(target, prop) {
			if (prop === 'run') {
				return async (...args: unknown[]) => {
					const startedAt = Date.now();
					const result = await (target.run as (...a: unknown[]) => Promise<unknown>)(...args);
					const logId = logIdOf(result, target.aiGatewayLogId);
					if (logId) sink({ logId, startedAt, tools: toolsOf(args[1]) });
					return result;
				};
			}
			if (prop === 'gateway') return (id: string) => wrapGateway(target.gateway(id));
			const value = Reflect.get(target, prop, target);
			return typeof value === 'function' ? value.bind(target) : value;
		},
	});
}
