/**
 * Settings every harness shares, so their metrics are comparable.
 * Nanocode only accepts GLM-5.3 on Workers AI, so every harness uses it.
 */
export const MODEL_ID = '@cf/zai-org/glm-5.3';
export const REASONING = 'low';

/** One AI Gateway for every harness (`default` is created on first use). Requests carry `{ harness, session }` metadata. */
export const GATEWAY_ID = 'default';

export const HARNESS_IDS = ['pi', 'nanocode', 'think', 'opencode', 'flue', 'self-modifying', 'codex'] as const;
export type HarnessId = (typeof HARNESS_IDS)[number];

export function isHarnessId(value: string): value is HarnessId {
	return (HARNESS_IDS as readonly string[]).includes(value);
}
