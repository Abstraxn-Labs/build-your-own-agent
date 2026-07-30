# Contributing

Thanks for helping grow **Build your Agent with Abstraxn**.

## Users vs contributors

- **Users** — pick one example, or fork and delete the rest (see root [README — fork options](../README.md#option-a--clone-and-ignore-fastest))
- **Contributors** — add examples or improve shared `packages/`

## Add a new use case

1. Copy `templates/next-agent` → `examples/NN-short-name`
2. Set a unique `dev` port in `package.json`
3. Edit `lib/agent.ts` (system prompt + tools) — this file is the **only** place that defines what the agent decides and when; tool implementations never live here
4. Add a tool set in `packages/mcp/src/index.ts` if needed
5. If the use case needs a tool that doesn't exist yet, implement it in the MCP-hosting service (`web3-agent-kit-service`), following its existing tool registration pattern — new tools are **not** defined inside the Next.js example app itself. See `examples/02-trading-agent` (built alongside this update) for the canonical worked example: its `coinbase_*` tools live in `web3-agent-kit-service/src/mcp/tools/`, registered in `mcp-tool-router.service.ts` + `mcp.module.ts`, and are only *consumed* here via a `TOOL_SETS` entry.
6. Any new tool that touches money or on-chain actions **must** have a policy check before execution — model it on `coinbase_place_order`'s per-trade USD cap guard (`web3-agent-kit-service/src/mcp/tools/coinbase-order-policy.util.ts`). Not optional, even for a minimal/demo version.
7. Test the new tool set read-only, and through its error path, against a real sandbox/testnet/zero-funds account **before** wiring the LLM decision layer on top — prove the tools work in isolation first.
8. Add `README.md` + `CONTENT.md` (blog outline, LinkedIn, video script)
9. Update the table in root [README.md](README.md)
10. `pnpm typecheck && pnpm build` from repo root
11. Open a PR

## Definition of done

- Runs with `.env` in under 5 minutes
- Custom logic lives in `lib/agent.ts` (and optional `lib/session.ts` for policies)
- No secrets committed; `.env.example` lists every required var with a comment on where to get it (dashboard URL, permission scope needed)
- README links to matching [Abstraxn docs](https://docs.abstraxn.com/guides/ai/agent-kit-overview)

## Coding rules

- Keep examples thin — shared logic belongs in `packages/*`
- Prefer named tool sets in `@abstraxn-examples/mcp`
- Do not duplicate `@abstraxn/agent-kit` or rebuild Agent Hub here

## Issues

- Bug in one example → mention which folder (e.g. `01-firecrawl-research`)
- Feature for all examples → propose in `packages/*` first
