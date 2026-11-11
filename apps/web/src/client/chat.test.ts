import { describe, expect, it } from 'vitest';
import { pendingTools, turnMessages, type ChatMessage } from './chat';

describe('pendingTools', () => {
	it('lists tool calls that have no result yet', () => {
		const message: ChatMessage = {
			id: 'a',
			role: 'assistant',
			timestamp: 0,
			parts: [
				{ type: 'tool-call', id: '1', name: 'write', arguments: {} },
				{ type: 'tool-result', id: '1', name: 'write', content: [], error: false },
				{ type: 'tool-call', id: '2', name: 'read', arguments: {} },
			],
		};
		expect(pendingTools(message)).toEqual(['read']);
		expect(pendingTools(null)).toEqual([]);
	});
});

describe('turnMessages', () => {
	it('returns the prompt and the answer', () => {
		const messages = turnMessages({ id: 't', prompt: 'hi', startedAt: 1, completedAt: 2, parts: [{ type: 'text', text: 'hello' }] });
		expect(messages.map((message) => [message.id, message.role, message.timestamp])).toEqual([
			['t:prompt', 'user', 1],
			['t:answer', 'assistant', 2],
		]);
	});

	it('omits an answer with nothing to show, but keeps an error', () => {
		expect(turnMessages({ id: 't', prompt: 'hi', startedAt: 1, parts: [] })).toHaveLength(1);
		expect(turnMessages({ id: 't', prompt: 'hi', startedAt: 1, parts: [], error: 'boom' }).at(-1)).toMatchObject({ error: 'boom' });
	});
});
