import { useEffect, useState } from 'react';
import type { HarnessId } from '@harnesses-on-do/shared/config';
import type { ModelCall } from '@harnesses-on-do/shared/metering';
import type { ChatMessage } from '../chat';

export type { ModelCall };

/**
 * Model calls come from AI Gateway (see `metering.ts`), the same for every
 * harness. The transcript adds what only it knows: where turns start, and how
 * many tool calls the model made.
 */
export function useModelCalls(harness: HarnessId, session: string, running: boolean): readonly ModelCall[] {
	const [calls, setCalls] = useState<readonly ModelCall[]>([]);
	useEffect(() => {
		let stopped = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const poll = async () => {
			try {
				const response = await fetch(`/api/metrics/${harness}/${session}`);
				if (response.ok && !stopped) setCalls((await response.json()) as ModelCall[]);
			} catch {
				// Try again on the next tick.
			}
			if (stopped) return;
			// Poll quickly while a turn runs or logs are still arriving, slowly otherwise.
			timer = setTimeout(poll, running ? 1500 : 5000);
		};
		poll();
		return () => {
			stopped = true;
			clearTimeout(timer);
		};
	}, [harness, session, running]);
	return calls;
}

export type Metrics = {
	readonly turns: number;
	/** From the user's message to the end of the last model call. Unset while running. */
	readonly durationMs?: number;
	readonly modelMs: number;
	readonly modelCalls: number;
	/** Calls whose gateway log has not arrived yet. */
	readonly pending: number;
	readonly toolCalls: number;
	readonly tokensIn: number;
	readonly tokensOut: number;
	readonly cost: number;
};

/** Grace for clock differences between the browser and the Durable Object. */
const SKEW_MS = 2000;

function measure(calls: readonly ModelCall[], toolCalls: number, startedAt: number | undefined, complete: boolean): Metrics {
	let end = 0;
	let modelMs = 0;
	let tokensIn = 0;
	let tokensOut = 0;
	let cost = 0;
	let pending = 0;
	for (const call of calls) {
		if (call.durationMs === undefined) {
			pending++;
			continue;
		}
		modelMs += call.durationMs;
		tokensIn += call.tokensIn ?? 0;
		tokensOut += call.tokensOut ?? 0;
		cost += call.cost ?? 0;
		end = Math.max(end, call.startedAt + call.durationMs);
	}
	const known = complete && pending === 0 && startedAt !== undefined && end > 0;
	return {
		turns: 1,
		...(known ? { durationMs: Math.max(end - startedAt, modelMs) } : {}),
		modelMs,
		modelCalls: calls.length,
		pending,
		toolCalls,
		tokensIn,
		tokensOut,
		cost,
	};
}

function toolCallsIn(messages: readonly ChatMessage[]): number {
	return messages.reduce((count, message) => count + message.parts.filter((part) => part.type === 'tool-call').length, 0);
}

/** The latest turn, and the whole session. */
export function metricsOf(
	messages: readonly ChatMessage[],
	calls: readonly ModelCall[],
	running: boolean,
): { last: Metrics | null; session: Metrics | null } {
	let userIndex = -1;
	messages.forEach((message, index) => {
		if (message.role === 'user') userIndex = index;
	});
	const turns = messages.filter((message) => message.role === 'user').length;
	if (userIndex === -1 && calls.length === 0) return { last: null, session: null };
	const turnStart = userIndex === -1 ? undefined : messages[userIndex].timestamp;
	const lastCalls = turnStart === undefined ? calls : calls.filter((call) => call.startedAt >= turnStart - SKEW_MS);
	return {
		last: userIndex === -1 ? null : measure(lastCalls, toolCallsIn(messages.slice(userIndex)), turnStart, !running),
		session: { ...measure(calls, toolCallsIn(messages), undefined, false), turns },
	};
}

export const format = {
	ms: (ms?: number) => (ms === undefined ? '—' : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`),
	tokens: (n: number) => n.toLocaleString(),
	usd: (n: number) => (n === 0 ? '$0' : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`),
};
