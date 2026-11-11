// Adapted from cloudflare/agents examples/next/harnesses/codex/src/server.ts.
// Changes: the model comes from agents/models/ai-sdk (which replaces
// workers-ai-provider) over the metered gateway, with the shared config, and agent traces.
import { Workspace } from '@cloudflare/computer';
import { MODEL_ID, REASONING } from '@harnesses-on-do/shared/config';
import { meteredGateway } from '@harnesses-on-do/shared/metering';
import { Lifecycle } from 'agents/lifecycle';
import { createAI } from 'agents/models/ai-sdk';
import { Sessions } from 'agents/sessions';
import { Streams } from 'agents/streams';
import { WebSockets } from 'agents/websockets';
import { DurableObject } from 'cloudflare:workers';
import { TracedTasks } from '../tracing';
import { CodexHarness } from './upstream/codex-harness';

/** A plain Durable Object composed with the Codex Lifecycle capability. */
export class Coder extends DurableObject<Env> {
	readonly session = this.ctx.id.name ?? this.ctx.id.toString();
	readonly identity = { name: 'Coder', session: this.session };
	readonly tasks = new TracedTasks(this.identity);
	readonly streams = new Streams();
	readonly sessions = new Sessions();
	readonly workspace = new Workspace({ storage: this.ctx.storage });
	readonly codex = new CodexHarness({
		tasks: this.tasks,
		streams: this.streams,
		sessions: this.sessions,
		workspace: this.workspace,
		model: createAI(meteredGateway(this.env, 'codex', this.session, this.identity))(MODEL_ID, { reasoningEffort: REASONING }),
	});
	readonly webSockets = new WebSockets(
		this.codex.webSockets({
			// Abort the object after the reply is sent, so the client can watch the
			// operation and Workspace survive a fresh incarnation.
			restart: () => setTimeout(() => this.ctx.abort('restart requested from the UI'), 50),
		}),
	);
	readonly lifecycle = Lifecycle.install(this).use(this.tasks).use(this.streams).use(this.sessions).use(this.webSockets).use(this.codex);
}
