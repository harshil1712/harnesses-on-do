// Adapted from cloudflare/agents examples/next/harnesses/self-modifying/src/server.ts.
// Changes: the model comes from agents/models/ai-sdk (which replaces
// workers-ai-provider) over the metered gateway, with the shared config, and agent traces.
import { Workspace } from '@cloudflare/computer';
import { MODEL_ID, REASONING } from '@harnesses-on-do/shared/config';
import { meteredGateway } from '@harnesses-on-do/shared/metering';
import { Lifecycle } from 'agents/lifecycle';
import { createAI } from 'agents/models/ai-sdk';
import { Streams } from 'agents/streams';
import { WebSockets } from 'agents/websockets';
import { DurableObject } from 'cloudflare:workers';
import { TracedTasks } from '../tracing';
import { SelfModifyingHarness } from './upstream/self-modifying-harness';

/** A plain Durable Object hosting the self-modifying Lifecycle capability. */
export class SelfModifyingHarnessObject extends DurableObject<Env> {
	readonly session = this.ctx.id.name ?? this.ctx.id.toString();
	readonly workspace = new Workspace({ storage: this.ctx.storage });
	readonly identity = { name: 'SelfModifyingHarnessObject', session: this.session };
	readonly tasks = new TracedTasks(this.identity);
	readonly streams = new Streams();
	readonly harness = new SelfModifyingHarness({
		tasks: this.tasks,
		streams: this.streams,
		workspace: this.workspace,
		loader: this.env.LOADER,
		model: createAI(meteredGateway(this.env, 'self-modifying', this.session, this.identity))(MODEL_ID, { reasoningEffort: REASONING }),
	});
	readonly webSockets = new WebSockets(this.harness.webSockets());
	readonly lifecycle = Lifecycle.install(this).use(this.tasks).use(this.streams).use(this.webSockets).use(this.harness);
}
