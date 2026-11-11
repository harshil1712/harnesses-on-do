/**
 * The display model every harness maps into. It is the shape of the upstream
 * Pi example's transcript (`harnesses/pi/transcript.ts`), so the Pi adapter is
 * a pass-through and other harnesses map onto it. Metrics come from AI Gateway.
 */

export type TextPart = { readonly type: 'text'; readonly text: string };
export type ImagePart = { readonly type: 'image'; readonly data: string; readonly mimeType: string };

export type ChatPart =
	| TextPart
	| ImagePart
	| { readonly type: 'thinking'; readonly text: string }
	| { readonly type: 'tool-call'; readonly id: string; readonly name: string; readonly arguments: unknown }
	| {
			readonly type: 'tool-result';
			readonly id: string;
			readonly name: string;
			readonly content: readonly (TextPart | ImagePart)[];
			readonly details?: unknown;
			readonly error: boolean;
	  };

export type ChatMessage = {
	readonly id: string;
	readonly role: 'user' | 'assistant' | 'tool' | 'notice' | 'summary';
	readonly parts: readonly ChatPart[];
	/** Unix ms. User messages need it: metrics split turns at them. */
	readonly timestamp: number;
	readonly error?: string;
};

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

/** What every harness's session hook returns to the shared UI. */
export type HarnessSession = {
	readonly status: ConnectionStatus;
	readonly messages: readonly ChatMessage[];
	/** The assistant message being streamed, if any. */
	readonly live: ChatMessage | null;
	readonly running: boolean;
	readonly runningTools: readonly string[];
	readonly error: string | null;
	submit(text: string): void;
	/** Unset when the harness cannot stop a running turn. */
	readonly abort?: () => void;
	/** Harness-specific extras, for its Capabilities tab. */
	readonly steer?: (text: string) => void;
	readonly queued?: number;
	readonly tools?: readonly { readonly name: string; readonly description: string }[];
	/** Abort the Durable Object mid-flight, to watch the harness recover. */
	readonly restart?: () => void;
	/** Set once the harness reconnected after a restart. */
	readonly recovered?: boolean;
	/** For harnesses that version their own code (Self-modifying). */
	readonly revisions?: {
		readonly active: number;
		readonly all: readonly { readonly id: number; readonly note: string; readonly createdAt: number }[];
		readonly files: readonly { readonly path: string; readonly size: number }[];
		restore(id: number): void;
	};
};

/** Tools called in `message` that have no result yet. */
export function pendingTools(message: ChatMessage | null): string[] {
	if (!message) return [];
	const done = new Set(message.parts.flatMap((part) => (part.type === 'tool-result' ? [part.id] : [])));
	return message.parts.flatMap((part) => (part.type === 'tool-call' && !done.has(part.id) ? [part.name] : []));
}

/** The user and assistant messages of one turn, for harnesses that report turns rather than messages. */
export function turnMessages(turn: {
	id: string;
	prompt: string | undefined;
	startedAt: number;
	completedAt?: number;
	parts: readonly ChatPart[];
	error?: string;
}): ChatMessage[] {
	const messages: ChatMessage[] = [];
	if (turn.prompt !== undefined) {
		messages.push({ id: `${turn.id}:prompt`, role: 'user', parts: [{ type: 'text', text: turn.prompt }], timestamp: turn.startedAt });
	}
	if (turn.parts.length > 0 || turn.error) {
		messages.push({
			id: `${turn.id}:answer`,
			role: 'assistant',
			parts: turn.parts,
			timestamp: turn.completedAt ?? turn.startedAt,
			...(turn.error ? { error: turn.error } : {}),
		});
	}
	return messages;
}
