import { DurableObject } from 'cloudflare:workers';
import { GATEWAY_ID, type HarnessId } from './config';
import { meter, type CallSink, type OfferedTool, type RecordedCall } from './meter';
import { traceModelCalls, type AgentIdentity } from './tracing';

/**
 * One metrics source for every harness: AI Gateway.
 *
 * `meter()` records the gateway log id of each model call a harness makes, and
 * the `Metering` object resolves those ids with the binding's
 * `gateway().getLog()`, which returns the tokens, cost and duration AI Gateway
 * measured. No harness code changes, and every harness is measured the same way.
 */

export { meter } from './meter';

export type ModelCall = RecordedCall & {
	/** Gateway-measured. Unset until AI Gateway has the log. */
	readonly durationMs?: number;
	readonly tokensIn?: number;
	readonly tokensOut?: number;
	/** USD. */
	readonly cost?: number;
	readonly model?: string;
	readonly success?: boolean;
};

/** The bindings a harness Worker needs to meter its model calls. */
export type MeteringEnv = { AI: Ai; Metering: DurableObjectNamespace<Metering> };

export function meteringKey(harness: HarnessId, session: string): string {
	return `${harness}:${session}`;
}

/** A sink that records into the `Metering` object for one harness session. */
export function meteringSink(namespace: DurableObjectNamespace<Metering>, harness: HarnessId, session: string): CallSink {
	const stub = namespace.getByName(meteringKey(harness, session));
	return (call) => {
		stub.record(call).catch((error: unknown) => console.warn('metering: record failed', error));
	};
}

/**
 * The options `createAI()` takes in every `agents/models/*` provider: the
 * metered `AI` binding, the shared gateway, and `{ harness, session }` metadata.
 * With `trace`, each model call also gets a `chat` span, for harnesses whose
 * framework does not trace model calls itself.
 */
export function meteredGateway(env: MeteringEnv, harness: HarnessId, session: string, trace?: AgentIdentity) {
	const binding = meter(env.AI, meteringSink(env.Metering, harness, session));
	return {
		binding: trace ? traceModelCalls(binding, trace) : binding,
		id: GATEWAY_ID,
		metadata: { harness, session },
	};
}

type Row = { log_id: string; started_at: number; log: string | null; tools: string | null };

/** The model calls of one harness session, resolved against AI Gateway logs. */
export class Metering extends DurableObject<{ AI: Ai }> {
	constructor(ctx: DurableObjectState, env: { AI: Ai }) {
		super(ctx, env);
		ctx.storage.sql.exec(
			`CREATE TABLE IF NOT EXISTS calls (
				log_id TEXT PRIMARY KEY,
				started_at INTEGER NOT NULL,
				log TEXT,
				tools TEXT
			)`,
		);
		// Tables created before tools were recorded.
		const columns = ctx.storage.sql.exec<{ name: string }>('PRAGMA table_info(calls)').toArray();
		if (!columns.some((column) => column.name === 'tools')) ctx.storage.sql.exec('ALTER TABLE calls ADD COLUMN tools TEXT');
	}

	async record(call: RecordedCall): Promise<void> {
		// Store a tool list only when it changes: lists can be large, and every poll returns them.
		const tools = call.tools ? JSON.stringify(call.tools) : null;
		const [previous] = this.ctx.storage.sql
			.exec<{ tools: string }>('SELECT tools FROM calls WHERE tools IS NOT NULL ORDER BY started_at DESC LIMIT 1')
			.toArray();
		this.ctx.storage.sql.exec(
			'INSERT OR IGNORE INTO calls (log_id, started_at, tools) VALUES (?, ?, ?)',
			call.logId,
			call.startedAt,
			tools === previous?.tools ? null : tools,
		);
	}

	async calls(): Promise<ModelCall[]> {
		const rows = this.ctx.storage.sql.exec<Row>('SELECT log_id, started_at, log, tools FROM calls ORDER BY started_at').toArray();
		const gateway = this.env.AI.gateway(GATEWAY_ID);
		return Promise.all(rows.map((row) => this.#resolve(gateway, row)));
	}

	async #resolve(gateway: AiGateway, row: Row): Promise<ModelCall> {
		const base = { logId: row.log_id, startedAt: row.started_at, ...(row.tools ? { tools: JSON.parse(row.tools) as OfferedTool[] } : {}) };
		if (row.log) return { ...base, ...(JSON.parse(row.log) as Omit<ModelCall, keyof RecordedCall>) };
		try {
			const entry = await gateway.getLog(row.log_id);
			const log = {
				durationMs: entry.duration,
				tokensIn: entry.tokens_in,
				tokensOut: entry.tokens_out,
				cost: entry.cost,
				model: entry.model,
				success: entry.success,
			};
			this.ctx.storage.sql.exec('UPDATE calls SET log = ? WHERE log_id = ?', JSON.stringify(log), row.log_id);
			return { ...base, ...log };
		} catch {
			// AI Gateway writes logs asynchronously; ask again on the next poll.
			return base;
		}
	}
}
