# agentic-x402-router

An **x402-paid model gateway**: a paid inference endpoint shaped for agent-discoverable LLM inference.

The server supports local mock mode, x402-protected mode, real Anthropic-backed Claude aliases for `POST /v1/model-call`, and a paid onchain market-signal endpoint.

## What This Is

- A TypeScript Express server for raw-ish model calls.
- A provider-agnostic gateway surface with Anthropic and deterministic mock providers.
- A local and paid target for `POST /v1/model-call`.
- x402 payment protection for `POST /v1/model-call` when enabled.
- Bazaar discovery metadata wired into the x402 route config.
- A pricing and cost-estimation experiment for paid inference endpoints.

## What This Is Not Yet

- Not an official Claude or Anthropic API.
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
       -> Anthropic provider or mock fallback
       -> pricing + cost + margin calculation
       -> normalized JSON response
  -> centralized error handler
```

`express.json()` is intentionally not mounted globally. The x402 middleware runs before JSON parsing and Zod business validation on paid routes.

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

No Anthropic key is needed for local mock mode. Set `ANTHROPIC_API_KEY` to call real Claude locally after payment is disabled or in paid deployment after x402 payment succeeds.

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

The model aliases are:

- `claude-haiku`
- `claude-sonnet`
- `claude-opus`
- `mock-fast`

Claude-family aliases resolve to Anthropic when `ANTHROPIC_API_KEY` is configured, and to the deterministic mock provider when it is not.

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

x402.org unauthenticated facilitator mode:

```bash
X402_ENABLED=true
X402_PAY_TO=0xYourWalletAddress
X402_NETWORK=base-sepolia
X402_FACILITATOR_URL=https://x402.org/facilitator
X402_DEFAULT_PRICE_USD=0.04
X402_RESOURCE_BASE_URL=https://your-public-host.example
```

This mode does not require CDP keys and is useful for testnet checks.

Coinbase CDP authenticated facilitator mode:

```bash
X402_ENABLED=true
X402_PAY_TO=0xYourWalletAddress
X402_NETWORK=base
X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
X402_DEFAULT_PRICE_USD=0.04
X402_RESOURCE_BASE_URL=https://your-public-host.example
CDP_API_KEY_ID=your-cdp-api-key-id
# Use either CDP_API_KEY_SECRET or CDP_API_KEY_SECRET_B64 (see below)
CDP_API_KEY_SECRET=your-cdp-api-key-secret
```

CDP mode requires `CDP_API_KEY_ID` and exactly one of `CDP_API_KEY_SECRET` or `CDP_API_KEY_SECRET_B64`.

#### Providing the CDP secret

**Option A — Plain text with escaped newlines (local `.env`):**

Paste the PEM with literal `\n` sequences:

```
CDP_API_KEY_SECRET=-----BEGIN EC PRIVATE KEY-----\nabc123\n-----END EC PRIVATE KEY-----
```

The app normalizes `\n` escape sequences to real newlines before passing the key to the CDP client.

**Option B — Base64-encoded PEM (recommended for Railway):**

Railway can mangle multiline environment variable values. Encode the PEM file as a single-line base64 string on your local machine and set `CDP_API_KEY_SECRET_B64` instead:

```bash
base64 -i cdp_key.pem | tr -d '\n'
```

Copy the output and set it in Railway:

```
CDP_API_KEY_SECRET_B64=<output of the command above>
```

When `CDP_API_KEY_SECRET_B64` is set it takes precedence over `CDP_API_KEY_SECRET`. The app decodes it at startup; the decoded PEM is never logged.

Never commit CDP keys to version control.

### Railway CDP env checklist

Set these Railway variables:

- `NODE_ENV=production`
- `PORT` from Railway, or omit and let Railway inject it
- `PUBLIC_BASE_URL=https://<your-railway-domain>`
- `X402_ENABLED=true`
- `X402_PAY_TO=0xYourWalletAddress`
- `X402_NETWORK=base` or `base-sepolia`
- `X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402`
- `X402_RESOURCE_BASE_URL=https://<your-railway-domain>`
- `CDP_API_KEY_ID`
- `CDP_API_KEY_SECRET_B64` ← recommended for Railway (see above), or `CDP_API_KEY_SECRET`
- `ANTHROPIC_API_KEY` for real Claude-backed `/v1/model-call`
- `ANTHROPIC_HAIKU_MODEL=claude-haiku-4-5`
- `ANTHROPIC_SONNET_MODEL=claude-sonnet-4-6`
- `ANTHROPIC_OPUS_MODEL=claude-opus-4-7`
- `MODEL_PROVIDER_TIMEOUT_MS=60000`

`POST /v1/model-call` is protected by x402. The route uses one fixed v1 price per call from `X402_DEFAULT_PRICE_USD`; default is `$0.04`.

The x402 middleware is mounted before route-local JSON parsing and Zod validation. An unpaid request with no body or an invalid business body should return `402 Payment Required`, not a model-call validation error.

## Anthropic Model Provider

Set `ANTHROPIC_API_KEY` server-side to enable real Claude-backed model calls:

```bash
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_HAIKU_MODEL=claude-haiku-4-5
ANTHROPIC_SONNET_MODEL=claude-sonnet-4-6
ANTHROPIC_OPUS_MODEL=claude-opus-4-7
MODEL_PROVIDER_TIMEOUT_MS=60000
```

The key is never sent to clients and should only be configured in `.env` locally or Railway environment variables in production. `mock-fast` always uses the mock provider. Claude aliases use Anthropic when the key exists and mock fallback when it does not.

For v1, `/v1/model-call` uses one fixed x402 price before request-body parsing. The default is `$0.04` per call via `X402_DEFAULT_PRICE_USD`, and all pricing and provider-cost assumptions remain env-configurable.

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

### DexScreener mode

DexScreener is the first real market data provider. It is enabled explicitly:

```bash
MARKET_SIGNAL_PROVIDER=dexscreener
DEXSCREENER_BASE_URL=https://api.dexscreener.com
MARKET_SIGNAL_PROVIDER_TIMEOUT_MS=5000
COST_MARKET_SIGNAL_DEXSCREENER_USD=0
```

```bash
curl -sS -X POST http://localhost:3000/v1/market-signal \
  -H "content-type: application/json" \
  --data @examples/market-signal.json
```

When enabled, the endpoint returns `data_source: "dexscreener"` if upstream data is available. If DexScreener is not explicitly configured or its base URL is invalid, the registry uses the mock provider. Runtime upstream failures are handled cleanly; the provider wrapper can return deterministic mock data when the fallback path is active.

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

This field is always present in every 200 response. The summary field contains observational language only and does not provide recommendations or projected outcomes.

## Buyer Scripts: Real Paid x402 Requests

`examples/buyer-market-signal.ts` sends a real x402-paid `POST /v1/market-signal` request against the Railway production endpoint using a local burner wallet.

`examples/buyer-model-call.ts` sends a real x402-paid `POST /v1/model-call` request. In production, this calls Anthropic only after the x402 payment is accepted and `ANTHROPIC_API_KEY` is configured server-side.

### Burner wallet setup

1. **Generate a fresh Base Sepolia burner wallet** — use any EVM wallet tool (e.g. Coinbase Wallet, MetaMask, or `cast wallet new` from Foundry). This wallet should hold testnet funds only.

2. **Fund it with Base Sepolia USDC** — the x402 `exact` scheme charges a small USDC amount per call. Get testnet USDC from the [Coinbase Developer Faucet](https://faucet.circle.com/) or the [Base Sepolia bridge](https://bridge.base.org/). You also need a small amount of Base Sepolia ETH for gas.

   You do not need mainnet assets. Never use a mainnet private key here.

3. **Add the private key to `.env`** (not `.env.example`):

   ```bash
   EVM_PRIVATE_KEY=0x<your-burner-private-key>
   ```

   The key is read from `.env` at runtime and never logged. Confirm `.env` is in `.gitignore` before adding real keys.

4. **Optionally override the target URL** (defaults to Railway production):

   ```bash
   PAID_ENDPOINT_URL=https://agentic-x402-router-production.up.railway.app/v1/market-signal
   PAID_MODEL_CALL_URL=https://agentic-x402-router-production.up.railway.app/v1/model-call
   ```

### Run the buyer scripts

```bash
npm run buyer:model-call
npm run buyer:market-signal
```

The script will:

1. Load `EVM_PRIVATE_KEY` from `.env` and exit clearly if it is missing.
2. Create a viem WalletClient for Base Sepolia from the private key.
3. Wrap `fetch` with x402 payment handling via `wrapFetchWithPayment` from `@x402/fetch`.
4. POST the request body, automatically intercept the `402`, sign the USDC payment, and retry.
5. Print the response status, any `X-Payment-Response` settlement header, and the full response JSON.

Model-call example output:

```
=== x402 Model Call Buyer ===
Endpoint : https://agentic-x402-router-production.up.railway.app/v1/model-call
Wallet   : 0xYourBurnerAddress
Network  : Base Sepolia (eip155:84532)
Body     : {"model":"claude-sonnet","messages":[...],"max_tokens":300,"temperature":0.2,...}

Status: 200 OK
X-Payment-Response: <base64-encoded-settlement>

Response:
{
  "ok": true,
  "id": "req_...",
  "model": "claude-sonnet",
  "provider": "anthropic",
  "text": "...",
  "usage": {
    "input_tokens": 123,
    "output_tokens": 45,
    "charged_usd": 0.04,
    "estimated_provider_cost_usd": 0.001044,
    "estimated_margin_usd": 0.038956
  }
}
```

Market-signal example output:

```
=== x402 Market Signal Buyer ===
Endpoint : https://agentic-x402-router-production.up.railway.app/v1/market-signal
Wallet   : 0xYourBurnerAddress
Network  : Base Sepolia (eip155:84532)
Body     : {"token":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","signals":["liquidity","volume","price_impact","wallet_flows"]}

Status: 200 OK
X-Payment-Response: <base64-encoded-settlement>

Response:
{
  "ok": true,
  "id": "req_...",
  "chain": "base",
  "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  ...
  "disclaimer": "Market signals are informational only and do not constitute financial advice."
}
```

### Security reminders

- `.env` is `.gitignore`-listed — confirm this before committing.
- Never put a real private key in `.env.example`.
- Use only Base Sepolia testnet keys and funds with this script.
- The private key is never printed, logged, or transmitted to the server.

## Bazaar Discovery

Discovery metadata is centralized in `src/bazaar/metadata.ts` and wired into the x402 route config with `declareDiscoveryExtension` from `@x402/extensions/bazaar`. Both endpoints have their own metadata, tags, input/output schemas, and Bazaar extension factories in that file.

After deploying Phase 6, refresh Bazaar/Agentic.Market indexing against the public Railway URL and confirm `/v1/model-call` appears for searches like:

- `claude`
- `anthropic`
- `model call`
- `llm inference`
- `chat completion`
- `text generation`
- `reasoning`
- `coding`
- `cheap claude`
- `x402`

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
npm run buyer:model-call
npm run buyer:market-signal
```

## Pricing

### Model call (per call)

| Model | Default price | Notes |
|---|---|---|
| `claude-haiku` | `0.0009` USDC | Discovery price |
| `claude-sonnet` | `0.0009` USDC | Discovery price |
| `claude-opus` | `0.20` USDC | — |
| `mock-fast` | `0.001` USDC | Local testing only |

`0.0009 USDC = 900 USDC base units` (6-decimal USDC on Base). The x402 price string encodes this as `$0.000900`.

Provider cost estimates are configurable with the `COST_*_PER_MTOK_USD` env vars in `.env.example`.

#### Discovery pricing caveat

`0.0009` is an aggressive volume/discovery price intended for Agentic.Market ranking and early traction — it is **not a sustainable production margin**.

- Raw Anthropic Sonnet costs `$3/M input + $15/M output`. A call with ~45 output tokens costs ~`$0.000711` in provider fees, leaving only `~$0.000189` margin.
- Larger outputs (`max_tokens > ~150`) can push provider cost **above** `0.0009`, resulting in a net loss per call.
- Keep `max_tokens ≤ 150` while running at this price.
- For production scale: route through Haiku, apply cloud credit discounts, enforce stricter token caps, or raise the price.

Market signal prices (per call):

- `PRICE_MARKET_SIGNAL_USD=0.02`
- `COST_MARKET_SIGNAL_PROVIDER_USD=0.005`
- `COST_MARKET_SIGNAL_DEXSCREENER_USD=0`

## Safety Notes

- Raw prompts and message content are not logged, even partially.
- Anthropic API keys, CDP keys, payment headers, authorization headers, and private keys are not logged.
- This service is intended for legitimate paid inference calls. Do not use it to simulate demand, manipulate marketplace ranking, generate fake traffic, or automate self-calling loops.
