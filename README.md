# Harnesses on DO

Agent harnesses running in Cloudflare Durable Objects, one page per harness. Every page has the same chat UI, model (`@cf/zai-org/glm-5.3`) and metrics, so you can compare harnesses by switching between them.

Harnesses: Pi, Nanocode, Think, OpenCode, Flue, Self-modifying and Codex (Wasm).

## Run it

You need Node.js 22.19+, pnpm, Rust (`rustup toolchain install 1.95.0 --target wasm32-unknown-unknown`) and a Cloudflare account (`npx wrangler login`). Model calls run on your account's Workers AI.

```sh
pnpm install
cp apps/nanocode/.dev.vars.example apps/nanocode/.dev.vars   # set your account ID
pnpm dev
```

Open http://localhost:5173. If you have several Cloudflare accounts, set `CLOUDFLARE_ACCOUNT_ID`.

## Deploy

```sh
cd apps/nanocode && npx wrangler secret put WORKERS_AI_ACCOUNT_ID && cd ../..
pnpm deploy
```

The app has no authentication. Put it behind [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) before sharing the URL.

## Layout

```
apps/web         UI, plus the Pi, Think, OpenCode, Self-modifying and Codex Durable Objects
apps/flue        Flue Worker
apps/nanocode    Nanocode Worker
packages/shared  Config, AI Gateway metering and tracing
```

Metrics come from AI Gateway logs, so every harness is measured the same way. See [CONTRIBUTING.md](./CONTRIBUTING.md) to add a harness.

## License

[MIT](./LICENSE). Copied code keeps its license; see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
