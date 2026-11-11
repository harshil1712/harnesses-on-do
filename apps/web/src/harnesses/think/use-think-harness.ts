import { useAgentChat } from '@cloudflare/ai-chat/react';
import { useAgent } from 'agents/react';
import { getToolName, isToolUIPart, type UIMessage } from 'ai';
import { useState } from 'react';
import type { ChatMessage, ChatPart, ConnectionStatus, HarnessSession } from '../../client/chat';
import { messageStamps } from '../../client/lib/stamps';

function partsOf(message: UIMessage): ChatPart[] {
	return message.parts.flatMap((part): ChatPart[] => {
		if (part.type === 'text') return part.text ? [{ type: 'text', text: part.text }] : [];
		if (part.type === 'reasoning') return part.text ? [{ type: 'thinking', text: part.text }] : [];
		if (!isToolUIPart(part)) return [];
		const name = getToolName(part);
		const call: ChatPart = { type: 'tool-call', id: part.toolCallId, name, arguments: part.input };
		if (part.state === 'output-available') {
			const output = typeof part.output === 'string' ? part.output : JSON.stringify(part.output, null, 2);
			return [call, { type: 'tool-result', id: part.toolCallId, name, content: [{ type: 'text', text: output }], error: false }];
		}
		if (part.state === 'output-error') {
			return [call, { type: 'tool-result', id: part.toolCallId, name, content: [{ type: 'text', text: part.errorText }], error: true }];
		}
		return [call];
	});
}

/** Think's own client (`useAgentChat`), mapped onto the shared session shape. */
export function useThinkHarness(session: string): HarnessSession {
	const [status, setStatus] = useState<ConnectionStatus>('connecting');
	const stamp = messageStamps(`stamps:think:${session}`);
	const agent = useAgent({
		agent: 'ThinkAgent',
		name: session,
		onOpen: () => setStatus('open'),
		onClose: () => setStatus('closed'),
	});
	const chat = useAgentChat({ agent });
	const uiMessages = chat.messages as UIMessage[];
	const running = chat.status === 'submitted' || chat.status === 'streaming';

	const messages: ChatMessage[] = uiMessages.map((message) => ({
		id: message.id,
		role: message.role === 'user' ? 'user' : 'assistant',
		parts: partsOf(message),
		timestamp: stamp(message.id),
	}));
	const runningTools = uiMessages
		.flatMap((message) => message.parts)
		.filter((part) => isToolUIPart(part) && (part.state === 'input-available' || part.state === 'input-streaming'))
		.map((part) => getToolName(part as Parameters<typeof getToolName>[0]));

	return {
		status,
		messages,
		live: null,
		running,
		runningTools,
		error: chat.error ? chat.error.message : null,
		submit: (text) => void chat.sendMessage({ role: 'user', parts: [{ type: 'text', text }] }),
		abort: () => void chat.stop(),
	};
}
