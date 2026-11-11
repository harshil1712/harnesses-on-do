import { pendingTools, turnMessages, type ChatPart, type HarnessSession } from '../../client/chat';
import { useHarnessSession, type TurnEvent } from './upstream/use-harness-session';

/** Tool calls of one turn, from its durable event stream (as the upstream client reads them). */
function toolParts(events: readonly TurnEvent[]): ChatPart[] {
	const parts: ChatPart[] = [];
	const inputs = new Map<string, unknown>();
	for (const event of events) {
		const callId = typeof event.callId === 'string' ? event.callId : null;
		if (!callId) continue;
		const name = typeof event.name === 'string' ? event.name : 'tool';
		if (event.type === 'tool_started') {
			inputs.set(callId, event.input);
			parts.push({ type: 'tool-call', id: callId, name, arguments: event.input });
		} else if (event.type === 'tool_completed' || event.type === 'tool_failed') {
			const result = typeof event.result === 'string' ? event.result : JSON.stringify(event.result, null, 2);
			parts.push({ type: 'tool-result', id: callId, name, content: [{ type: 'text', text: result }], error: event.type === 'tool_failed' });
		}
	}
	return parts;
}

/** The upstream example's `useHarnessSession`, mapped onto the shared session shape. */
export function useSelfModifyingHarness(session: string): HarnessSession {
	const harness = useHarnessSession(session);
	const turns = harness.snapshot?.turns ?? [];
	const messages = turns.flatMap((turn) => {
		const parts = toolParts(harness.events[turn.turnId] ?? []);
		if (turn.output) parts.push({ type: 'text', text: turn.output });
		return turnMessages({
			id: turn.turnId,
			prompt: turn.prompt,
			startedAt: turn.createdAt,
			completedAt: turn.completedAt ?? undefined,
			parts,
			error: turn.error ?? undefined,
		});
	});
	const running = harness.active !== null;

	return {
		status: harness.status,
		messages,
		live: null,
		running,
		runningTools: running ? pendingTools(messages.at(-1) ?? null) : [],
		error: harness.error ?? null,
		submit: harness.submit,
		revisions: harness.snapshot
			? {
					active: harness.snapshot.active.revisionId,
					all: harness.snapshot.revisions.map((revision) => ({
						id: revision.revisionId,
						note: revision.note,
						createdAt: revision.createdAt,
					})),
					files: harness.snapshot.files.map((file) => ({ path: file.path, size: file.size })),
					restore: harness.restore,
				}
			: undefined,
	};
}
