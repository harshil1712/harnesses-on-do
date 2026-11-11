import { pendingTools, turnMessages, type ChatPart, type HarnessSession } from '../../client/chat';
import type { KernelJson } from './upstream/protocol';
import { useCodexSession, type KernelEvent } from './upstream/use-codex-session';

function field(value: KernelJson | undefined, key: string): string | undefined {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
	const found = value[key];
	return typeof found === 'string' ? found : undefined;
}

/** Tool calls of one operation, from its kernel events (as the upstream client reads them). */
function toolParts(events: readonly KernelEvent[]): ChatPart[] {
	const parts: ChatPart[] = [];
	for (const event of events) {
		const id = String(event.call_id ?? event.effect_id ?? event.seq);
		if (event.type === 'tool_started') {
			parts.push({ type: 'tool-call', id, name: String(event.name ?? 'tool'), arguments: event.arguments });
		} else if (event.type === 'tool_completed') {
			parts.push({
				type: 'tool-result',
				id,
				name: String(event.name ?? 'tool'),
				content: [{ type: 'text', text: field(event.output, 'preview') ?? '' }],
				error: event.success === false,
			});
		}
	}
	return parts;
}

/** The upstream example's `useCodexSession`, mapped onto the shared session shape. */
export function useCodexHarness(session: string): HarnessSession {
	const codex = useCodexSession(session);
	const messages = codex.operations.flatMap((operation) => {
		const events = codex.events[operation.operationId] ?? [];
		const reasoning = events
			.filter((event) => event.type === 'reasoning_delta')
			.map((event) => String(event.delta ?? ''))
			.join('');
		const parts: ChatPart[] = [...(reasoning ? [{ type: 'thinking' as const, text: reasoning }] : []), ...toolParts(events)];
		if (operation.output) parts.push({ type: 'text', text: operation.output });
		return turnMessages({
			id: operation.operationId,
			prompt: operation.prompt,
			startedAt: operation.startedAt,
			completedAt: operation.completedAt,
			parts,
			error: operation.error,
		});
	});
	const running = codex.active !== null;

	return {
		status: codex.status,
		messages,
		live: null,
		running,
		runningTools: running ? pendingTools(messages.at(-1) ?? null) : [],
		error: codex.error ?? null,
		submit: codex.submit,
		tools: codex.tools,
		restart: codex.restart,
		recovered: codex.recovered,
	};
}
