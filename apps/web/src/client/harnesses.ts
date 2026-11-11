import { useCodexHarness } from '../harnesses/codex/use-codex-harness';
import { useFlueHarness } from '../harnesses/flue/use-flue-harness';
import { useNanocodeHarness } from '../harnesses/nanocode/use-nanocode-harness';
import { useOpenCodeHarness } from '../harnesses/opencode/use-opencode-harness';
import { useSelfModifyingHarness } from '../harnesses/self-modifying/use-self-modifying-harness';
import { usePiHarness } from '../harnesses/pi/use-pi-harness';
import { useThinkHarness } from '../harnesses/think/use-think-harness';
import type { HarnessId } from '@harnesses-on-do/shared/config';
import type { HarnessSession } from './chat';

export type HarnessInfo = {
	readonly id: HarnessId;
	readonly name: string;
	readonly tagline: string;
	readonly status: 'Recommended' | 'Experimental' | 'Pre-1.0';
	/** From the comparison table at developers.cloudflare.com/agents/harnesses/. */
	readonly durability: { readonly full: boolean; readonly label: string };
	/**
	 * Its agent spans: `automatic` from its framework, `app` added by this
	 * app (turn, model and tool spans), `model-calls` for model calls only, or
	 * `none` (AI Gateway only).
	 */
	readonly tracing: 'automatic' | 'app' | 'model-calls' | 'none';
	readonly docs: string;
	/** The upstream project or example this page is built from. */
	readonly source?: string;
	/** The harness's session hook, mapped onto the shared session shape. */
	readonly useSession: (session: string) => HarnessSession;
};

/** Every harness, in sidebar order. Keyed by id, so a missing harness fails to compile. */
const REGISTRY: { readonly [Id in HarnessId]: Omit<HarnessInfo, 'id'> } = {
	pi: {
		name: 'Pi',
		tagline: 'Pi Durable runs the loop, transcript and recovery inside a Durable Object.',
		status: 'Recommended',
		durability: { full: true, label: 'Automatically resumes interrupted work' },
		tracing: 'none',
		docs: 'https://developers.cloudflare.com/agents/harnesses/pi/',
		source: 'https://github.com/cloudflare/agents/tree/main/examples/next/harnesses/pi',
		useSession: usePiHarness,
	},
	nanocode: {
		name: 'Nanocode',
		tagline: 'Codex and Claude harnesses behind one Rust/Wasm runtime, in its own Durable Object host.',
		status: 'Pre-1.0',
		durability: { full: false, label: 'Resumes turns; some tools cannot recover' },
		tracing: 'model-calls',
		docs: 'https://developers.cloudflare.com/agents/harnesses/nanocode/',
		source: 'https://github.com/nanocodexyz/durable-cloudflare',
		useSession: useNanocodeHarness,
	},
	think: {
		name: 'Think',
		tagline: 'An AI SDK chat agent with built-in Workspace tools, scheduling and sub-agents.',
		status: 'Experimental',
		durability: { full: false, label: 'Continues from saved output' },
		tracing: 'automatic',
		docs: 'https://developers.cloudflare.com/agents/harnesses/think/',
		useSession: useThinkHarness,
	},
	opencode: {
		name: 'OpenCode',
		tagline: "OpenCode 2.0's sessions, tools and plugins in a plain Durable Object.",
		status: 'Experimental',
		durability: { full: false, label: 'Resumes interrupted work' },
		tracing: 'none',
		docs: 'https://developers.cloudflare.com/agents/harnesses/opencode/',
		source: 'https://github.com/cloudflare/agents/tree/main/examples/next/harnesses/opencode',
		useSession: useOpenCodeHarness,
	},
	flue: {
		name: 'Flue',
		tagline: 'A TypeScript hooks API built on Pi, with automatic recovery.',
		status: 'Experimental',
		durability: { full: true, label: 'Automatically resumes interrupted work' },
		tracing: 'automatic',
		docs: 'https://flueframework.com/docs/guide/cloudflare-target/',
		source: 'https://github.com/withastro/flue',
		useSession: useFlueHarness,
	},
	'self-modifying': {
		name: 'Self-modifying',
		tagline: 'An agent that edits its own TypeScript loop and runs it in Dynamic Workers.',
		status: 'Experimental',
		durability: { full: false, label: 'Resumes turns; custom tools may rerun' },
		tracing: 'app',
		docs: 'https://developers.cloudflare.com/agents/harnesses/self-modifying/',
		source: 'https://github.com/cloudflare/agents/tree/main/examples/next/harnesses/self-modifying',
		useSession: useSelfModifyingHarness,
	},
	codex: {
		name: 'Codex (Wasm)',
		tagline: "Codex's Rust turn loop compiled to WebAssembly, inside a Durable Object.",
		status: 'Experimental',
		durability: { full: false, label: 'Resumes work; interrupted steps may rerun' },
		tracing: 'app',
		docs: 'https://developers.cloudflare.com/agents/harnesses/codex/',
		source: 'https://github.com/cloudflare/agents/tree/main/examples/next/harnesses/codex',
		useSession: useCodexHarness,
	},
};

export const HARNESSES: readonly HarnessInfo[] = Object.entries(REGISTRY).map(([id, info]) => ({ id: id as HarnessId, ...info }));

/** Prompts that work on every harness, so their metrics can be compared. */
export const PRESETS = [
	{ label: 'Write a file', prompt: 'Write a haiku about Durable Objects to a file named haiku.txt, then read it back.' },
	{ label: 'Run code', prompt: 'Write and run a short program that prints the first 10 Fibonacci numbers.' },
	{
		label: 'Multi-step',
		prompt: 'Create notes.md with three facts about Cloudflare Workers, then append a fourth fact, then show the final file.',
	},
] as const;
