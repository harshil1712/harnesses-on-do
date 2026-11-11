import type { ChatMessage, HarnessSession } from '../../client/chat';
import { usePiSession } from './upstream/use-pi-session';

/** The upstream example's `usePiSession`, mapped onto the shared session shape. */
export function usePiHarness(session: string): HarnessSession {
	const pi = usePiSession(session);
	return {
		status: pi.status,
		// Gaps (entries this tab missed) are rare; the shared UI skips them.
		messages: pi.messages.filter((message) => message.role !== 'gap') as readonly ChatMessage[],
		live: pi.live as ChatMessage | null,
		running: pi.running,
		runningTools: pi.tools.map((tool) => tool.name),
		error: pi.error,
		submit: (text) => pi.submit(text, 'followUp'),
		abort: pi.abort,
		steer: (text) => pi.submit(text, 'steer'),
		queued: pi.queued,
		tools: pi.catalog,
	};
}
