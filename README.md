# agentic-x402-router

Phase 1 MVP for an **x402-paid model gateway**: a paid inference endpoint shaped for agent-discoverable LLM inference.

This phase is local mock mode only. It proves the backend shape, validation, provider abstraction, pricing/cost/margin response fields, and route ordering needed for a real x402 integration later.

## What This Is

- A TypeScript Express server for raw-ish model calls.
- A provider-agnostic gateway surface with a deterministic mock provider.
- A local development target for `POST /v1/model-call`.
- A pricing and cost-estimation experiment for paid inference endpoints.

## What This Is Not Yet

- Not an official Claude or Anthropic API.
- Not a real Anthropic integration yet.
- Not a real x402 payment integration yet.
- Not Bazaar metadata yet.
- Not a frontend, auth system, dashboard, or database.

## Architecture

```text
HTTP client
  -> request id middleware
  -> free routes: GET /health, GET /v1/models
  -> POST /v1/model-call
       -> phase 1 payment gate (requires X402_ENABLED=false)
       -> route-local express.json({ limit })
       -> Zod model-call validation
       -> provider selector
       -> mock provider
       -> pricing + cost + margin calculation
       -> normalized JSON response
  -> centralized error handler
```

`express.json()` is intentionally not mounted globally. In phase 2, real x402 middleware can be inserted before JSON parsing and Zod business validation on the paid route.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Phase 1 requires:

```bash
X402_ENABLED=false
```

No Anthropic key is needed for local mock mode.

## Test Health

```bash
curl -sS http://localhost:3000/health
```

Expected shape:

```json
{
  "ok": true,
  "service": "agentic-x402-router",
  "timestamp": "2026-04-24T00:00:00.000Z"
}
```

## List Models

```bash
curl -sS http://localhost:3000/v1/models
```

The phase 1 model aliases are:

- `claude-haiku`
- `claude-sonnet`
- `claude-opus`
- `mock-fast`

Claude-family aliases resolve to the mock provider unless a real provider is added in a later phase.

## Test Model Call

```bash
curl -sS -X POST http://localhost:3000/v1/model-call \
  -H "content-type: application/json" \
  --data @examples/sample-model-call.json
```

When `X402_ENABLED=false`, local calls work without payment and return a normalized response with:

- `charged_usd`
- `estimated_provider_cost_usd`
- `estimated_margin_usd`
- `timing.latency_ms`

If `X402_ENABLED=true`, phase 1 fails startup clearly because real x402 middleware is deferred to phase 2.

## Scripts

```bash
npm run dev
npm run typecheck
npm test
npm run build
```

## Pricing

Phase 1 uses fixed per-call prices:

- `PRICE_CLAUDE_HAIKU_USD=0.02`
- `PRICE_CLAUDE_SONNET_USD=0.05`
- `PRICE_CLAUDE_OPUS_USD=0.20`
- `PRICE_MOCK_FAST_USD=0.001`

Provider cost estimates are configurable with the `COST_*_PER_MTOK_USD` env vars in `.env.example`.

## Safety Notes

- Raw prompts are not logged by default.
- `LOG_PROMPTS=true` logs only a short preview, never the full payload.
- No provider secrets are required or logged in phase 1.
- This service is intended for legitimate paid inference calls. Do not use it to simulate buyers, manipulate marketplace ranking, generate fake traffic, or automate self-calling loops.

## Phase 2

Next phase:

- Add real Anthropic provider behind the existing `ModelProvider` interface.
- Add real x402 middleware before route-local JSON parsing and Zod validation.
- Add Bazaar/Agentic.Market discovery metadata in a centralized module.
- Verify unpaid `POST /v1/model-call` returns `402` before business validation when `X402_ENABLED=true`.
