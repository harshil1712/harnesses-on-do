import type { OpenCodeMessage } from 'agents/harness/opencode';
import type { ChatMessage, ChatPart, HarnessSession } from '../../client/chat';
import { partTexts, useOpenCodeSession, type LiveText } from './upstream/use-opencode-session';

/** One OpenCode session per Durable Object: the root session. */
const ROOT_SESSION = 'ses_root';

type Assistant = Extract<OpenCodeMessage, { type: 'assistant' }>;

function assistantParts(message: Assistant, live: LiveText | undefined): ChatPart[] {
	const texts = partTexts(live, message, 'text');
	const reasonings = partTexts(live, message, 'reasoning');
	const ordinals = { text: 0, reasoning: 0 };
	const parts = message.content.flatMap((part, index): ChatPart[] => {
		switch (part.type) {
			case 'text': {
				const text = texts[ordinals.text++] ?? '';
				return text ? [{ type: 'text', text }] : [];
			}
			case 'reasoning': {
				const text = reasonings[ordinals.reasoning++] ?? '';
				return text ? [{ type: 'thinking', text }] : [];
			}
			case 'tool': {
				const id = `${message.id}-${index}`;
				const call: ChatPart = { type: 'tool-call', id, name: part.name, arguments: part.state.input };
				const state = part.state;
				if (state.status !== 'completed' && state.status !== 'error') return [call];
				const text = (state.content ?? []).map((content) => (content.type === 'text' ? content.text : '')).join('\n');
				const error = state.status === 'error';
				return [
					call,
					{ type: 'tool-result', id, name: part.name, content: [{ type: 'text', text: error ? state.error.message : text }], error },
				];
			}
			default:
				return [];
		}
	});
	// Parts still streaming that the snapshot does not have yet.
	for (const text of reasonings.slice(ordinals.reasoning)) if (text) parts.push({ type: 'thinking', text });
	for (const text of texts.slice(ordinals.text)) if (text) parts.push({ type: 'text', text });
	return parts;
}

/** The upstream example's `useOpenCodeSession`, mapped onto the shared session shape. */
export function useOpenCodeHarness(session: string): HarnessSession {
	const opencode = useOpenCodeSession(session, ROOT_SESSION, () => {});
	const messages = opencode.messages.flatMap((message): ChatMessage[] => {
		switch (message.type) {
			case 'user':
				return [{ id: message.id, role: 'user', parts: [{ type: 'text', text: message.text }], timestamp: message.time.created }];
			case 'assistant':
				return [
					{
						id: message.id,
						role: 'assistant',
						parts: assistantParts(message, opencode.live[message.id]),
						timestamp: message.time.created,
						...(message.error ? { error: message.error.message } : {}),
					},
				];
			case 'synthetic':
				return [{ id: message.id, role: 'notice', parts: [{ type: 'text', text: message.description ?? message.text }], timestamp: 0 }];
			default:
				return [];
		}
	});
	const runningTools = opencode.messages.flatMap((message) =>
		message.type === 'assistant'
			? message.content.flatMap((part) =>
					part.type === 'tool' && part.state.status !== 'completed' && part.state.status !== 'error' ? [part.name] : [],
				)
			: [],
	);
	return {
		status: opencode.status,
		messages,
		live: null,
		running: opencode.busy,
		runningTools,
		error: opencode.error ?? null,
		submit: (text) => opencode.submit(text, 'followUp'),
		abort: opencode.abort,
		steer: (text) => opencode.submit(text, 'steer'),
		queued: opencode.pending.filter((operation) => operation.status === 'queued').length,
	};
}
