// Think, as documented at developers.cloudflare.com/agents/harnesses/think/.
// `@cloudflare/think` instruments turns automatically (agent traces) and adds
// Computer's workspace tools; it gets the same workspace as the other harnesses.
import { Think } from '@cloudflare/think';
import { MODEL_ID, REASONING } from '@harnesses-on-do/shared/config';
import { meteredGateway } from '@harnesses-on-do/shared/metering';
import { createAI } from 'agents/models/ai-sdk';
import { createWorkspace, WORKSPACE_PROMPT } from '../workspace';

export class ThinkAgent extends Think<Env> {
	override workspace = createWorkspace(this.ctx.storage, this.env.LOADER);
	// Record messages and tool calls on trace spans, for the dashboard's session replay.
	override storeMessages = true;
	override storeTools = true;

	override getModel() {
		return createAI(meteredGateway(this.env, 'think', this.name))(MODEL_ID, { reasoningEffort: REASONING });
	}

	override getSystemPrompt() {
		return WORKSPACE_PROMPT;
	}
}
