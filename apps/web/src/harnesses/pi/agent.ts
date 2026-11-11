// Adapted from cloudflare/agents examples/next/harnesses/pi/src/server.ts.
// Changes: the shared workspace, prompt, model and metered gateway.
import { createModels } from '@earendil-works/pi-ai/models';
import { createRegistry, Harness } from '@earendil-works/pi-durable';
import { MODEL_ID, REASONING } from '@harnesses-on-do/shared/config';
import { meteredGateway } from '@harnesses-on-do/shared/metering';
import { PiHarness } from 'agents/harness/pi';
import { Lifecycle } from 'agents/lifecycle';
import { createAI } from 'agents/models/pi-ai';
import { WebSockets } from 'agents/websockets';
import { DurableObject } from 'cloudflare:workers';
import { createWorkspace, WORKSPACE_PROMPT } from '../workspace';
import { PiSessionSockets } from './upstream/sockets';
import { createWorkspaceTools } from './upstream/workspace';

/** A Pi session backed by one Durable Object. */
export class PiAgent extends DurableObject<Env> {
	readonly session = this.ctx.id.name ?? this.ctx.id.toString();
	// Options must go on createAI: a Pi session stores only the model id, not its options.
	readonly ai = createAI(meteredGateway(this.env, 'pi', this.session));
	readonly workspace = createWorkspace(this.ctx.storage, this.env.LOADER);
	readonly registry = createRegistry();
	readonly harness = new PiHarness({
		harness: async ({ storage, context, onWake }) => {
			this.registry.install({
				name: 'playground',
				sections: [{ key: 'preamble', render: () => WORKSPACE_PROMPT, tag: false }],
				tools: createWorkspaceTools(this.workspace),
			});
			const models = createModels();
			models.setProvider(this.ai.provider);
			return Harness.open(
				storage,
				{
					models,
					registry: this.registry,
					onWake,
					settings: { retry: { enabled: true, maxRetries: 5, baseDelayMs: 1000 } },
					onReport: (report) => console.warn('pi report', report),
				},
				context,
			);
		},
		defaults: { model: this.ai(MODEL_ID), thinkingLevel: REASONING },
	});
	readonly sockets = new PiSessionSockets(this.harness, this.registry, (tag) => this.ctx.getWebSockets(tag));
	readonly webSockets = new WebSockets(this.sockets.options());
	readonly lifecycle = Lifecycle.install(this).use(this.webSockets).use(this.harness);

	async onStart(): Promise<void> {
		await this.sockets.reattach();
	}
}
