// Agent traces for the harnesses whose frameworks do not emit them. Model
// calls get `chat` spans from `meteredGateway(..., identity)`, tool runs get
// `execute_tool` spans where each harness runs its tools, and turns get
// `invoke_agent` spans here.
import { traceTurn, type AgentIdentity } from '@harnesses-on-do/shared/tracing';
import { Tasks, type TaskCallbacks } from 'agents/tasks';

/** Tasks whose registered task is a harness turn (Codex, Self-modifying): each run is an `invoke_agent` span. */
export class TracedTasks extends Tasks {
	readonly #identity: AgentIdentity;

	constructor(identity: AgentIdentity) {
		super();
		this.#identity = identity;
	}

	override register(name: string, definition: TaskCallbacks[string]): void {
		super.register(name, (input, step) => traceTurn(this.#identity, async () => definition(input, step)));
	}
}
