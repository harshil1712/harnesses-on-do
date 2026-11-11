import { describe, expect, it } from 'vitest';
import { meter, toolsOf, type RecordedCall } from './meter';

function response(logId?: string): Response {
	return new Response('{}', { headers: logId ? { 'cf-aig-log-id': logId } : {} });
}

/** Just enough of the `AI` binding for `meter()`. */
function fakeAi(result: unknown, aiGatewayLogId: string | null = null) {
	return {
		aiGatewayLogId,
		run: async () => result,
		gateway: () => ({ run: async () => response('gateway-log'), getLog: async () => ({}) }),
		models: async () => ['@cf/model'],
	} as unknown as Ai;
}

function recorded(ai: Ai): { metered: Ai; calls: RecordedCall[] } {
	const calls: RecordedCall[] = [];
	return { metered: meter(ai, (call) => calls.push(call)), calls };
}

describe('meter', () => {
	it('records the log id of a raw response', async () => {
		const { metered, calls } = recorded(fakeAi(response('log-1')));
		await metered.run('@cf/model' as never, {} as never);
		expect(calls).toEqual([{ logId: 'log-1', startedAt: expect.any(Number) }]);
	});

	it('falls back to aiGatewayLogId for parsed results', async () => {
		const { metered, calls } = recorded(fakeAi({ response: 'hi' }, 'log-2'));
		await metered.run('@cf/model' as never, {} as never);
		expect(calls.map((call) => call.logId)).toEqual(['log-2']);
	});

	it('records nothing when the call did not go through AI Gateway', async () => {
		const { metered, calls } = recorded(fakeAi({ response: 'hi' }));
		await metered.run('@cf/model' as never, {} as never);
		expect(calls).toEqual([]);
	});

	it('records gateway().run() calls', async () => {
		const { metered, calls } = recorded(fakeAi(null));
		await metered.gateway('default').run({} as never);
		expect(calls.map((call) => call.logId)).toEqual(['gateway-log']);
	});

	it('passes everything else through', async () => {
		const { metered } = recorded(fakeAi(null));
		await expect(metered.models()).resolves.toEqual(['@cf/model']);
	});
});

describe('toolsOf', () => {
	it('reads OpenAI chat, Responses and Workers AI tool lists', () => {
		const tools = [
			{ type: 'function', function: { name: 'read', description: 'Read a file' } },
			{ type: 'function', name: 'write', description: 'Write a file' },
			{ name: 'exec' },
			{ type: 'web_search' },
		];
		expect(toolsOf({ tools })).toEqual([
			{ name: 'read', description: 'Read a file' },
			{ name: 'write', description: 'Write a file' },
			{ name: 'exec', description: '' },
		]);
	});

	it('is undefined for a request without tools', () => {
		expect(toolsOf({ messages: [] })).toBeUndefined();
		expect(toolsOf(undefined)).toBeUndefined();
	});
});
