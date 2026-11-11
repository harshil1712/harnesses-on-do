# Contributing

Thanks for helping. Issues and pull requests are welcome.

## Setup

See the [README](./README.md#run-it). Before opening a pull request, run:

```sh
pnpm check   # typecheck, lint, format check and unit tests
pnpm build
```

CI runs the same commands.

## Conventions

- **Reuse upstream code; don't fork it.** Each harness starts from its upstream example or reference host. Copy upstream files unchanged into an `upstream/` folder and list them in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). If you must change one, mark the change with a `harnesses-on-do change` comment.
- **Keep harnesses comparable.** Every harness uses the model, reasoning level and gateway in `packages/shared/src/config.ts`, and the same workspace and prompt where it supports them (`apps/web/src/harnesses/workspace.ts`).
- **Measure through AI Gateway.** Pass the harness's `AI` binding through `meteredGateway()` (or `meter()`) from `@harnesses-on-do/shared/metering`, so its model calls show up in the metrics rail. Don't add per-harness metrics.
- **Trace it, if its framework does not.** Pass an identity (`{ name, session }`) to `meteredGateway()` for `chat` spans, and wrap its turns in `traceTurn()` and its tool runs in `traceTool()` from `@harnesses-on-do/shared/tracing`. Spans are recorded only while the request or alarm that runs the work is alive, so check in the local trace explorer that they nest under the turn.
- **Style:** Prettier (tabs, single quotes, 140 columns) and ESLint, both enforced in CI.

## Adding a harness

1. Add its id to `HARNESS_IDS` in `packages/shared/src/config.ts`. The registry won't compile until step 4 is done.
2. Host it:
   - **In `apps/web`**, if it runs as a Durable Object class the web Worker can export. Add `apps/web/src/harnesses/<id>/agent.ts`, export the class from `src/server.ts`, and add a binding and a new migration in `apps/web/wrangler.jsonc`.
   - **As its own Worker in `apps/<id>`**, if it owns its build (as Flue and Nanocode do). Serve a `/metrics/:session` route from its own `Metering` object, add a service binding in `apps/web/wrangler.jsonc`, and route it in `externalWorker()` in `apps/web/src/server.ts`.
3. Map its client onto `HarnessSession` (`apps/web/src/client/chat.ts`) in `apps/web/src/harnesses/<id>/use-<id>-harness.ts`. Prefer the harness's own client hook; the helpers in `chat.ts` cover the common cases.
4. Register it in `apps/web/src/client/harnesses.ts`.
5. Run every preset on the new page with `pnpm dev`, and check the transcript, the tool cards and the metrics rail.
