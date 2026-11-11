import { Workspace, type DurableObjectStorageLike } from '@cloudflare/computer';
import { CodemodeBackend } from '@cloudflare/computer/backends/codemode';
import { createGitClient } from '@cloudflare/computer/git';
import { createGitModule } from '@cloudflare/computer/modules/git';

/**
 * The Cloudflare Computer workspace the upstream Pi example gives its agent:
 * files on the object's SQLite, and `exec` running JavaScript in a fresh
 * Dynamic Worker. Shared so every harness that supports Computer gets the
 * same tools and prompt, and the presets compare like with like.
 */
export function createWorkspace(storage: DurableObjectStorage, loader: WorkerLoader): Workspace {
	return new Workspace({
		// The SQL cursor type is narrower than the storage interface declares; the runtime shape matches.
		storage: storage as unknown as DurableObjectStorageLike,
		git: createGitClient(),
		backends: [
			new CodemodeBackend({
				loader,
				root: '/workspace',
				access: 'read-write',
				modules: { 'codemode:git': createGitModule({ allowNetwork: true }) },
			}),
		],
	});
}

export const WORKSPACE_PROMPT =
	'You are a concise playground assistant. You have a durable workspace at /workspace: read, write, edit, delete, list (ls), find and grep files there, and run JavaScript modules in it with exec, which can also use git. Paths are absolute. Use tools whenever they can answer the request, and explain their results plainly.';
