// Adapted from cloudflare/agents examples/next/harnesses/opencode/src/server.ts.
// Changes: the shared workspace, model and metered gateway.
import { OpenCodeWorkerd } from '@opencode/sdk/workerd';
import { MODEL_ID, REASONING } from '@harnesses-on-do/shared/config';
import { meteredGateway } from '@harnesses-on-do/shared/metering';
import { OpenCodeHarness } from 'agents/harness/opencode';
import { Lifecycle } from 'agents/lifecycle';
import { createAI } from 'agents/models/opencode';
import { WebSockets } from 'agents/websockets';
import { DurableObject } from 'cloudflare:workers';
import { createWorkspace } from '../workspace';
import { OpenCodeSessionSockets } from './upstream/sockets';
import { workspacePlugin } from './upstream/workspace';

/** An OpenCode instance backed by one Durable Object. */
export class OpenCodeAgent extends DurableObject<Env> {
	readonly session = this.ctx.id.name ?? this.ctx.id.toString();
	readonly ai = createAI(meteredGateway(this.env, 'opencode', this.session));
	readonly workspace = createWorkspace(this.ctx.storage, this.env.LOADER);
	readonly harness = new OpenCodeHarness({
		opencode: ({ storage }) =>
			OpenCodeWorkerd.create({
				storage,
				config: { default_agent: 'build' },
				models: { fetch: false },
				log: {
					level: 'warn',
					emit: (entry) => console.warn(`opencode ${entry.level}: ${entry.message}`, entry.attributes, entry.cause),
				},
				plugins: [this.ai.plugin, workspacePlugin(this.workspace)],
			}),
		defaults: { model: this.ai(MODEL_ID, { reasoningEffort: REASONING }), agent: 'build' },
	});
	readonly sockets = new OpenCodeSessionSockets(this.harness, (tag) => this.ctx.getWebSockets(tag));
	readonly webSockets = new WebSockets(this.sockets.options());
	readonly lifecycle = Lifecycle.install(this).use(this.webSockets).use(this.harness);

	async onStart(): Promise<void> {
		await this.sockets.reattach();
	}
}
