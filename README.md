# agentic-x402-router

Phase 1 MVP for an **x402-paid model gateway**: a paid inference endpoint shaped for agent-discoverable LLM inference.

The current server supports local mock mode and x402-protected mode. Model calls still use the deterministic mock provider; Anthropic is intentionally deferred.

## What This Is

- A TypeScript Express server for raw-ish model calls.
- A provider-agnostic gateway surface with a deterministic mock provider.
- A local development target for `POST /v1/model-call`.
- x402 payment protection for `POST /v1/model-call` when enabled.
- Bazaar discovery metadata wired into the x402 route config.
- A pricing and cost-estimation experiment for paid inference endpoints.

## What This Is Not Yet

- Not an official Claude or Anthropic API.
- Not a real Anthropic integration yet.
- Not a real Anthropic integration yet.
- Not a frontend, auth system, dashboard, or database.

## Architecture

```text
HTTP client
  -> request id middleware
  -> free routes: GET /health, GET /v1/models
  -> POST /v1/model-call
       -> x402 middleware (no-op when X402_ENABLED=false)
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

For local mock mode:

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

## x402-Enabled Mode

Set:

```bash
X402_ENABLED=true
X402_PAY_TO=0xYourWalletAddress
X402_NETWORK=base-sepolia
X402_FACILITATOR_URL=https://x402.org/facilitator
X402_DEFAULT_PRICE_USD=0.05
X402_RESOURCE_BASE_URL=https://your-public-host.example
```

`POST /v1/model-call` is protected by x402. The route uses one fixed v1 price per call from `X402_DEFAULT_PRICE_USD`. Provider execution is still mock-mode until a real provider is added.

The x402 middleware is mounted before route-local JSON parsing and Zod validation. An unpaid request with no body or an invalid business body should return `402 Payment Required`, not a model-call validation error.

## Market Signal Endpoint

`POST /v1/market-signal` is a second paid endpoint for onchain token market data, designed for trading bots and autonomous agents.

### Supported inputs

| Field | Values | Default |
|---|---|---|
| `chain` | `base`, `ethereum`, `solana`, `arbitrum`, `optimism`, `polygon` | `base` |
| `timeframe` | `5m`, `15m`, `1h`, `4h`, `24h` | `1h` |
| `signals` | `liquidity`, `volume`, `price_change`, `price_impact`, `pool_activity`, `wallet_flows` | required |
| `token` | EVM `0x…` address or Solana pubkey | required |
| `pool` | Optional specific DEX pool address | — |

Only requested signals are included in the response. Unrequested fields are absent.

### Local mock mode

```bash
curl -sS -X POST http://localhost:3000/v1/market-signal \
  -H "content-type: application/json" \
  --data @examples/market-signal.json
```

Response includes `data_source: "mock"` and a fixed disclaimer. Values are deterministic for the same `chain + token + timeframe` combination.

### x402-enabled unpaid check

With `X402_ENABLED=true` and valid env:

```bash
# no body — should return 402, not 400
curl -i -X POST http://localhost:3000/v1/market-signal

# invalid body — should return 402, not 400
curl -i -X POST http://localhost:3000/v1/market-signal \
  -H "content-type: application/json" \
  --data '{}'
```

### Pricing

- `PRICE_MARKET_SIGNAL_USD=0.02` — charged to the caller per call
- `COST_MARKET_SIGNAL_PROVIDER_USD=0.005` — estimated upstream data cost

### Disclaimer

Every successful response includes:

```
"disclaimer": "Market signals are informational only and do not constitute financial advice."
```

This field is always present in every 200 response. The summary field contains observational language only — no buy, sell, bullish, bearish, or directional recommendations.

## Bazaar Discovery

Discovery metadata is centralized in `src/bazaar/metadata.ts` and wired into the x402 route config with `declareDiscoveryExtension` from `@x402/extensions/bazaar`. Both endpoints have their own metadata, tags, input/output schemas, and Bazaar extension factories in that file.

## Manual Unpaid 402 Checklist

Start the server with valid x402 env and `X402_ENABLED=true`, then run:

```bash
# Model call — should 402
curl -i -X POST http://localhost:3000/v1/model-call
curl -i -X POST http://localhost:3000/v1/model-call \
  -H "content-type: application/json" \
  --data '{}'

# Market signal — should 402
curl -i -X POST http://localhost:3000/v1/market-signal
curl -i -X POST http://localhost:3000/v1/market-signal \
  -H "content-type: application/json" \
  --data '{}'

# Free routes — should 200
curl -i http://localhost:3000/health
curl -i http://localhost:3000/v1/models
```

Expected:

- Unpaid `POST /v1/model-call` and `POST /v1/market-signal` return `402`, not `400`.
- `GET /health` and `GET /v1/models` return `200`.

## Scripts

```bash
npm run dev
npm run typecheck
npm test
npm run build
```

## Pricing

Model call prices (per call):

- `PRICE_CLAUDE_HAIKU_USD=0.02`
- `PRICE_CLAUDE_SONNET_USD=0.05`
- `PRICE_CLAUDE_OPUS_USD=0.20`
- `PRICE_MOCK_FAST_USD=0.001`

Provider cost estimates are configurable with the `COST_*_PER_MTOK_USD` env vars in `.env.example`.

Market signal prices (per call):

- `PRICE_MARKET_SIGNAL_USD=0.02`
- `COST_MARKET_SIGNAL_PROVIDER_USD=0.005`

## Safety Notes

- Raw prompts and message content are not logged, even partially.
- No provider secrets are required or logged in phase 2.
- This service is intended for legitimate paid inference calls. Do not use it to simulate buyers, manipulate marketplace ranking, generate fake traffic, or automate self-calling loops.

## Next Provider Phase

Next:

- Add real Anthropic provider behind the existing `ModelProvider` interface.
- Keep x402 middleware before route-local JSON parsing and Zod validation.
- Verify paid requests still return usage, revenue, margin, and latency.
