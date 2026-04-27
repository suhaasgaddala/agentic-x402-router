# Demo — agentic-x402-router

A production-deployed x402-paid AI/agent API gateway on Base Sepolia.

## Live App

```
https://agentic-x402-router-production.up.railway.app
```

## Endpoints

| Route | Method | Price | Provider |
|---|---|---|---|
| `/v1/model-call` | POST | 0.001 USDC | Anthropic Claude Sonnet |
| `/v1/market-signal` | POST | 0.02 USDC | DexScreener |

## What This Demo Proves

- **Public Railway deployment** — fully serverless, auto-deployed from `main`.
- **x402/CDP payment-required flow** — unpaid calls return `402 Payment Required` with a `WWW-Authenticate: x402` header before any business logic runs.
- **Paid buyer request** — local burner wallet on Base Sepolia pays and receives Claude output or DexScreener signals.
- **Real Anthropic output** — model-call returns actual Claude Sonnet inference.
- **Real DexScreener data** — market-signal returns live onchain liquidity/volume data.
- **Bazaar discovery indexing** — both endpoints register with `@x402/extensions/bazaar` and are discoverable via the Bazaar API.

---

## Verification Commands

### 1. Service status

```bash
curl https://agentic-x402-router-production.up.railway.app/
curl https://agentic-x402-router-production.up.railway.app/health
curl https://agentic-x402-router-production.up.railway.app/v1/capabilities
```

### 2. Unpaid 402 checks

```bash
# model-call — no payment header → 402 Payment Required
curl -i -X POST https://agentic-x402-router-production.up.railway.app/v1/model-call

# market-signal — no payment header → 402 Payment Required
curl -i -X POST https://agentic-x402-router-production.up.railway.app/v1/market-signal
```

Both should return `HTTP/2 402` with `WWW-Authenticate: x402` and no business-logic output.

### 3. Paid buyer requests (requires Base Sepolia USDC + EVM_PRIVATE_KEY in .env)

```bash
npm run buyer:model-call
npm run buyer:market-signal
```

### 4. Bazaar discovery

```bash
# Search for model-call endpoint
curl "https://api.bazaar.x402.org/search?q=model+call+agent"

# Search for market-signal endpoint
curl "https://api.bazaar.x402.org/search?q=onchain+market+signal"

# Merchant discovery (list all endpoints registered by this service)
curl "https://api.bazaar.x402.org/merchants?address=YOUR_WALLET_ADDRESS"
```

---

## Notes

- **Network**: Base Sepolia testnet. No mainnet funds are used.
- **Anthropic cost caveat**: `0.001 USDC` is a discovery price. Raw Claude Sonnet cost can exceed this for large outputs. The `MODEL_CALL_MAX_OUTPUT_TOKENS=300` cap limits exposure.
- **No secrets committed**: `.env` is gitignored. `.env.example` uses placeholder values only.
- **Agentic.Market UI lag**: The UI may filter or delay testnet endpoints even when the Bazaar API successfully indexes the resources. Use the Bazaar API directly to verify indexing.
