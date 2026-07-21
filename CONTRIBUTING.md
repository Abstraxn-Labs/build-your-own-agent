# Contributing

Thanks for helping grow **Build your Agent with Abstraxn**.

## Users vs contributors

- **Users** — pick one example, or fork and delete the rest (see root [README — fork options](../README.md#option-a--clone-and-ignore-fastest))
- **Contributors** — add examples or improve shared `packages/`

## Add a new use case

1. Copy `templates/next-agent` → `examples/NN-short-name`
2. Set a unique `dev` port in `package.json`
3. Edit `lib/agent.ts` (system prompt + tools)
4. Add a tool set in `packages/mcp/src/index.ts` if needed
5. Add `README.md` + `CONTENT.md` (blog outline, LinkedIn, video script)
6. Update the table in root [README.md](README.md)
7. `pnpm typecheck && pnpm build` from repo root
8. Open a PR

## Definition of done

- Runs with `.env` in under 5 minutes
- Custom logic lives in `lib/agent.ts` (and optional `lib/session.ts` for policies)
- No secrets committed
- README links to matching [Abstraxn docs](https://docs.abstraxn.com/guides/ai/agent-kit-overview)

## Coding rules

- Keep examples thin — shared logic belongs in `packages/*`
- Prefer named tool sets in `@abstraxn-examples/mcp`
- Do not duplicate `@abstraxn/agent-kit` or rebuild Agent Hub here

## Issues

- Bug in one example → mention which folder (e.g. `01-firecrawl-research`)
- Feature for all examples → propose in `packages/*` first
