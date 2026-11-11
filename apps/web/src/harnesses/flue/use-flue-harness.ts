import { useFlueAgent, type FlueConversationMessage, type FlueConversationPart } from '@flue/react';
import { createFlueClient } from '@flue/sdk';
import { useMemo } from 'react';
import { pendingTools, type ChatMessage, type ChatPart, type HarnessSession } from '../../client/chat';

/** Where apps/web forwards to the Flue Worker (see server.ts). */
const MOUNT = '/api/flue/agents/assistant';

function textOf(value: unknown): string {
	return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function partsOf(part: FlueConversationPart): ChatPart[] {
	switch (part.type) {
		case 'text':
			return [{ type: 'text', text: part.text }];
		case 'reasoning':
			return part.text ? [{ type: 'thinking', text: part.text }] : [];
		case 'dynamic-tool': {
			const call: ChatPart = { type: 'tool-call', id: part.toolCallId, name: part.toolName, arguments: part.input };
			if (part.state === 'input-available') return [call];
			const error = part.state === 'output-error';
			const text = error ? part.errorText : textOf(part.output);
			return [call, { type: 'tool-result', id: part.toolCallId, name: part.toolName, content: [{ type: 'text', text }], error }];
		}
		default:
			return [];
	}
}

function messageOf(message: FlueConversationMessage): ChatMessage {
	const timestamp = 'timestamp' in message && typeof message.timestamp === 'string' ? Date.parse(message.timestamp) : Date.now();
	return {
		id: message.id,
		role: message.role === 'system' ? 'notice' : message.role,
		parts: message.parts.flatMap(partsOf),
		timestamp,
	};
}

/** Flue's `useFlueAgent` (from @flue/react), mapped onto the shared session shape. */
export function useFlueHarness(session: string): HarnessSession {
	// Our own client, so the page can also abort a running response.
	const client = useMemo(() => createFlueClient({ url: new URL(`${MOUNT}/${session}`, location.origin).href }), [session]);
	const agent = useFlueAgent({ client });
	const visible = agent.messages.filter((message) => message.display === 'visible');
	const running = agent.status === 'submitted' || agent.status === 'streaming';
	const last = visible.at(-1);
	const streaming = running && last?.role === 'assistant';
	const messages = visible.map(messageOf);
	const live = streaming ? messages.pop()! : null;

	return {
		status: agent.status === 'connecting' && !agent.historyReady ? 'connecting' : 'open',
		messages,
		live,
		running,
		runningTools: pendingTools(live),
		error: agent.error?.message ?? null,
		submit: (text) => void agent.sendMessage(text),
		abort: () => void client.abort(),
	};
}
