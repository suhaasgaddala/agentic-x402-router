/**
 * Buyer script: sends a real x402-paid POST /v1/model-call request.
 *
 * Requirements:
 *   - EVM_PRIVATE_KEY must be set in .env (Base Sepolia burner wallet only)
 *   - PAID_MODEL_CALL_URL is optional; defaults to the Railway production URL
 *
 * The private key is never logged. Do not fund this wallet with mainnet assets.
 *
 * Usage:
 *   npm run buyer:model-call
 */
import "dotenv/config";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { ExactEvmScheme } from "@x402/evm";
import type { ClientEvmSigner } from "@x402/evm";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";

const RAW_KEY = process.env.EVM_PRIVATE_KEY;

if (!RAW_KEY) {
  console.error(
    "Error: EVM_PRIVATE_KEY is not set.\n" +
      "Add EVM_PRIVATE_KEY=0x<your-burner-private-key> to your .env file.\n" +
      "Use a Base Sepolia burner wallet only. Never use a mainnet key here."
  );
  process.exit(1);
}

const privateKey: `0x${string}` = RAW_KEY.startsWith("0x")
  ? (RAW_KEY as `0x${string}`)
  : (`0x${RAW_KEY}` as `0x${string}`);

const ENDPOINT_URL =
  process.env.PAID_MODEL_CALL_URL ??
  "https://agentic-x402-router-production.up.railway.app/v1/model-call";

const NETWORK = "eip155:84532";
const account = privateKeyToAccount(privateKey);

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http()
});

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http()
});

const evmSigner: ClientEvmSigner = {
  address: account.address,
  signTypedData: (args) =>
    walletClient.signTypedData(args as Parameters<typeof walletClient.signTypedData>[0]),
  readContract: (args) =>
    publicClient.readContract(args as Parameters<typeof publicClient.readContract>[0])
};

const paymentClient = new x402Client().register(NETWORK, new ExactEvmScheme(evmSigner));
const fetchWithPayment = wrapFetchWithPayment(fetch, paymentClient);

// max_tokens is intentionally small: at the 0.0009 USDC discovery price,
// Sonnet provider cost (~$3/M in + $15/M out) can exceed the charged amount
// for larger responses. Keep requests short during price discovery testing.
const requestBody = {
  model: "claude-sonnet",
  messages: [
    {
      role: "user",
      content: "In one sentence, explain why x402-paid model access is useful for agents."
    }
  ],
  max_tokens: 80,
  temperature: 0.2,
  metadata: {
    client: "buyer-script",
    task: "model-call-smoke-test"
  }
};

console.log("=== x402 Model Call Buyer ===");
console.log(`Endpoint : ${ENDPOINT_URL}`);
console.log(`Wallet   : ${account.address}`);
console.log(`Network  : Base Sepolia (${NETWORK})`);
console.log(`Body     : ${JSON.stringify(requestBody)}`);
console.log();

const response = await fetchWithPayment(ENDPOINT_URL, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(requestBody)
});

console.log(`Status: ${response.status} ${response.statusText}`);

const xPaymentResponse = response.headers.get("x-payment-response");
if (xPaymentResponse) {
  console.log(`X-Payment-Response: ${xPaymentResponse}`);
}

const body = (await response.json()) as unknown;

console.log("\nResponse:");
console.log(JSON.stringify(body, null, 2));
