import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../chat';
import { format, metricsOf, type ModelCall } from './metrics';

const user = (id: string, timestamp: number): ChatMessage => ({ id, role: 'user', parts: [{ type: 'text', text: id }], timestamp });
const assistant = (id: string, timestamp: number, tools = 0): ChatMessage => ({
	id,
	role: 'assistant',
	parts: Array.from({ length: tools }, (_, index) => ({ type: 'tool-call' as const, id: `${id}-${index}`, name: 'read', arguments: {} })),
	timestamp,
});
const call = (startedAt: number, durationMs?: number): ModelCall => ({
	logId: `log-${startedAt}`,
	startedAt,
	...(durationMs === undefined ? {} : { durationMs, tokensIn: 100, tokensOut: 10, cost: 0.001 }),
});

describe('metricsOf', () => {
	it('is empty before the first turn', () => {
		expect(metricsOf([], [], false)).toEqual({ last: null, session: null });
	});

	it('measures the latest turn from its user message to the end of its last model call', () => {
		const messages = [user('u1', 0), assistant('a1', 1_000, 1), user('u2', 10_000), assistant('a2', 11_000, 2)];
		const calls = [call(500, 500), call(10_500, 1_000), call(12_000, 2_000)];
		const { last, session } = metricsOf(messages, calls, false);
		expect(last).toMatchObject({ modelCalls: 2, modelMs: 3_000, durationMs: 4_000, toolCalls: 2, tokensIn: 200 });
		expect(session).toMatchObject({ turns: 2, modelCalls: 3, modelMs: 3_500, toolCalls: 3 });
		expect(session?.durationMs).toBeUndefined();
	});

	it('leaves the duration unset while running or while gateway logs are pending', () => {
		const messages = [user('u1', 0)];
		expect(metricsOf(messages, [call(100, 900)], true).last?.durationMs).toBeUndefined();
		const pending = metricsOf(messages, [call(100, 900), call(1_000)], false).last;
		expect(pending).toMatchObject({ pending: 1, modelCalls: 2 });
		expect(pending?.durationMs).toBeUndefined();
	});
});

describe('format', () => {
	it('formats durations, tokens and cost', () => {
		expect(format.ms(undefined)).toBe('—');
		expect(format.ms(250)).toBe('250 ms');
		expect(format.ms(2_345)).toBe('2.3 s');
		expect(format.usd(0)).toBe('$0');
		expect(format.usd(0.0012)).toBe('$0.0012');
		expect(format.usd(0.5)).toBe('$0.50');
	});
});
