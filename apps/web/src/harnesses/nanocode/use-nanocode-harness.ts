import { useCallback, useEffect, useMemo, useState } from 'react';
import { pendingTools, turnMessages, type ChatMessage, type ChatPart, type ConnectionStatus, type HarnessSession } from '../../client/chat';

/**
 * Nanocode's documented session API (POST /turns, SSE /events), through the
 * NANOCODE service binding. Its own client (`nanocode-ts/cloudflare/transport`)
 * ships with the 130 MB engine package, so the page reads the stored event log
 * directly, the way `nanocode-ts/client`'s `LiveEvent.fromLogged` does.
 */
const MOUNT = '/api/nanocode/sessions';
const TURN = { provider: 'codex', model: 'glm-5.3', thinking: 'low' } as const;

export type Logged = { seq: number; request_id: string | null; created_at: number; event: Record<string, unknown> };
type AgentEvent = { type: string; payload: Record<string, unknown> };

function agentEvent(logged: Logged): AgentEvent | undefined {
	const body = logged.event;
	return body.source === 'agent' && typeof body.event === 'object' && body.event !== null ? (body.event as AgentEvent) : undefined;
}

function resultText(result: unknown): string {
	if (typeof result === 'string') return result;
	if (Array.isArray(result)) return result.map((item) => (typeof item?.text === 'string' ? item.text : JSON.stringify(item))).join('');
	return JSON.stringify(result, null, 2);
}

function argumentsOf(value: unknown): unknown {
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

/** One user message and one assistant message per turn (request id), in log order. */
export function transcript(events: readonly Logged[]): { messages: ChatMessage[]; active: string | null; error: string | null } {
	const turns = new Map<
		string,
		{ prompt?: string; at: number; parts: ChatPart[]; deltas: Map<string, string>; done: boolean; error?: string }
	>();
	for (const logged of events) {
		const id = logged.request_id;
		if (!id) continue;
		let turn = turns.get(id);
		if (!turn) turns.set(id, (turn = { at: logged.created_at, parts: [], deltas: new Map(), done: false }));
		const body = logged.event;
		if (body.type === 'result') {
			turn.done = true;
			if (body.status !== 'completed') turn.error = typeof body.error === 'string' ? body.error : JSON.stringify(body.error ?? body.status);
			continue;
		}
		const event = agentEvent(logged);
		if (!event) continue;
		const p = event.payload;
		switch (event.type) {
			case 'input.accepted':
				if (p.kind === 'prompt' && typeof p.input === 'string') turn.prompt ??= p.input;
				break;
			case 'tool.call':
				turn.parts.push({ type: 'tool-call', id: String(p.call_id), name: String(p.tool), arguments: argumentsOf(p.arguments) });
				break;
			case 'tool.result':
				turn.parts.push({
					type: 'tool-result',
					id: String(p.call_id),
					name: String(p.tool),
					content: [{ type: 'text', text: resultText(p.result) }],
					error: p.status !== 'completed',
				});
				break;
			case 'assistant.delta':
				turn.deltas.set(String(p.item_id), (turn.deltas.get(String(p.item_id)) ?? '') + String(p.text ?? ''));
				break;
			case 'assistant.message':
				turn.deltas.delete(String(p.item_id));
				if (typeof p.text === 'string' && p.text) turn.parts.push({ type: 'text', text: p.text });
				break;
		}
	}

	const messages: ChatMessage[] = [];
	let active: string | null = null;
	let error: string | null = null;
	for (const [id, turn] of turns) {
		const streamed = [...turn.deltas.values()].filter(Boolean).map((text): ChatPart => ({ type: 'text', text }));
		messages.push(...turnMessages({ id, prompt: turn.prompt, startedAt: turn.at, parts: [...turn.parts, ...streamed], error: turn.error }));
		if (!turn.done) active = id;
		if (turn.error) error = turn.error;
	}
	return { messages, active, error };
}

export function useNanocodeHarness(session: string): HarnessSession {
	const [events, setEvents] = useState<readonly Logged[]>([]);
	const [status, setStatus] = useState<ConnectionStatus>('connecting');
	const [failure, setFailure] = useState<string | null>(null);

	// The page remounts per session, so this effect starts from empty state.
	useEffect(() => {
		// EventSource resumes from the last `id:` (the event seq) on reconnect.
		const source = new EventSource(`${MOUNT}/${session}/events?after=0`);
		const seen = new Set<number>();
		source.onopen = () => setStatus('open');
		source.onerror = () => setStatus(source.readyState === EventSource.CLOSED ? 'closed' : 'connecting');
		source.onmessage = (message) => {
			const logged = JSON.parse(message.data) as Logged;
			if (seen.has(logged.seq)) return;
			seen.add(logged.seq);
			setEvents((current) => [...current, logged]);
		};
		return () => source.close();
	}, [session]);

	const { messages, active, error } = useMemo(() => transcript(events), [events]);
	const running = active !== null;
	const last = running ? messages.at(-1) : undefined;
	const live = last?.role === 'assistant' ? last : null;

	const submit = useCallback(
		(prompt: string) => {
			setFailure(null);
			void fetch(`${MOUNT}/${session}/turns`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ request_id: crypto.randomUUID(), prompt, ...TURN }),
			}).then(async (response) => {
				if (!response.ok) setFailure(`Nanocode refused the turn: ${response.status} ${await response.text()}`);
			});
		},
		[session],
	);

	return {
		status,
		messages: live ? messages.slice(0, -1) : messages,
		live,
		running,
		runningTools: pendingTools(live),
		error: failure ?? error,
		submit,
		abort: active ? () => void fetch(`${MOUNT}/${session}/turns/${active}/cancel`, { method: 'POST' }) : undefined,
	};
}
