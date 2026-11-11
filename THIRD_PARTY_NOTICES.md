# Third-party notices

This project copies code from the projects below. Copied files live in `upstream/` folders (or the paths listed) and keep their upstream style; Prettier and ESLint skip them. Files that adapt upstream code say so in a header comment, and mark changes with "harnesses-on-do change".

## Cloudflare Agents SDK examples

From [cloudflare/agents](https://github.com/cloudflare/agents) (`examples/next/harnesses/*`). MIT License, Copyright (c) 2025 Cloudflare, Inc.

- `apps/web/src/harnesses/pi/upstream/`
- `apps/web/src/harnesses/opencode/upstream/`
- `apps/web/src/harnesses/self-modifying/upstream/`
- `apps/web/src/harnesses/codex/upstream/`
- `apps/web/codex-kernel/`
- Adapted: `apps/web/src/harnesses/*/agent.ts`, `apps/web/src/client/components/Transcript.tsx` and `apps/web/src/client/styles.css`

## Pi

Parts of the Pi example derive from [Pi](https://github.com/earendil-works/pi). MIT License, Copyright (c) 2025 Mario Zechner. The license text is in `apps/web/src/harnesses/pi/upstream/licenses/mit-earendil-pi.txt`.

## OpenAI Codex

The Codex kernel (`apps/web/codex-kernel/`) adapts code from [openai/codex](https://github.com/openai/codex). Apache License 2.0, Copyright OpenAI. See `apps/web/codex-kernel/THIRD_PARTY_NOTICES.md` and `apps/web/codex-kernel/LICENSE-CODEX-APACHE-2.0`.

## Flue

`apps/flue/src/sandboxes/cloudflare-computer.ts` is the Cloudflare Computer sandbox blueprint from [Flue](https://github.com/withastro/flue) (`flue add sandbox cloudflare-computer`). Apache License 2.0; the license text is in `apps/flue/src/sandboxes/LICENSE-FLUE-APACHE-2.0`.

## Nanocode

`apps/nanocode` uses [nanocode-ts](https://github.com/nanocodexyz/nanocode-ts) as a dependency (MIT or Apache-2.0, Copyright (c) 2026 Nanocode Contributors), and follows its [reference Worker](https://github.com/nanocodexyz/durable-cloudflare).
