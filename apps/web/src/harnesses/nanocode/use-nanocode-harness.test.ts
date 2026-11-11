import { describe, expect, it } from 'vitest';
import { transcript, type Logged } from './use-nanocode-harness';

let seq = 0;
const logged = (request_id: string, event: Record<string, unknown>): Logged => ({ seq: seq++, request_id, created_at: 1_000 + seq, event });
const agent = (type: string, payload: Record<string, unknown>) => ({ source: 'agent', event: { type, payload } });

describe('nanocode transcript', () => {
	it('maps a completed turn from the event log', () => {
		const { messages, active, error } = transcript([
			logged('r1', { type: 'queued', request_id: 'r1' }),
			logged('r1', agent('input.accepted', { kind: 'prompt', input: 'write a file' })),
			logged('r1', agent('tool.call', { call_id: 'c1', tool: 'apply_patch', arguments: '{"path":"a.txt"}' })),
			logged('r1', agent('tool.result', { call_id: 'c1', tool: 'apply_patch', status: 'completed', result: 'ok' })),
			logged('r1', agent('assistant.message', { item_id: 'm1', text: 'Done.' })),
			logged('r1', { type: 'result', status: 'completed' }),
		]);
		expect(active).toBeNull();
		expect(error).toBeNull();
		expect(messages.map((message) => message.role)).toEqual(['user', 'assistant']);
		expect(messages[1].parts).toEqual([
			{ type: 'tool-call', id: 'c1', name: 'apply_patch', arguments: { path: 'a.txt' } },
			{ type: 'tool-result', id: 'c1', name: 'apply_patch', content: [{ type: 'text', text: 'ok' }], error: false },
			{ type: 'text', text: 'Done.' },
		]);
	});

	it('streams deltas while a turn runs, and reports failures', () => {
		const running = transcript([
			logged('r2', agent('input.accepted', { kind: 'prompt', input: 'hi' })),
			logged('r2', agent('assistant.delta', { item_id: 'm2', text: 'Hel' })),
			logged('r2', agent('assistant.delta', { item_id: 'm2', text: 'lo' })),
		]);
		expect(running.active).toBe('r2');
		expect(running.messages.at(-1)?.parts).toEqual([{ type: 'text', text: 'Hello' }]);

		const failed = transcript([logged('r3', { type: 'result', status: 'failed', error: 'model timed out' })]);
		expect(failed.error).toBe('model timed out');
	});
});
