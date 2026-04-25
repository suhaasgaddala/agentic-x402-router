/**
 * Buyer script: sends a real x402-paid POST /v1/market-signal request.
 *
 * Requirements:
 *   - EVM_PRIVATE_KEY must be set in .env (Base Sepolia burner wallet only)
 *   - PAID_ENDPOINT_URL is optional; defaults to the Railway production URL
 *
 * The private key is never logged. Do not fund this wallet with mainnet assets.
 *
 * Usage:
 *   npm run buyer:market-signal
 */
import "dotenv/config";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import type { ClientEvmSigner } from "@x402/evm";

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
  process.env.PAID_ENDPOINT_URL ??
  "https://agentic-x402-router-production.up.railway.app/v1/market-signal";

// Base Sepolia is the only supported network for this buyer script.
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

// Adapt viem clients to the ClientEvmSigner shape expected by @x402/evm.
// Runtime shapes are compatible; the cast bridges viem's strict generic parameters.
const evmSigner: ClientEvmSigner = {
  address: account.address,
  signTypedData: (args) =>
    walletClient.signTypedData(args as Parameters<typeof walletClient.signTypedData>[0]),
  readContract: (args) =>
    publicClient.readContract(args as Parameters<typeof publicClient.readContract>[0])
};

const paymentClient = new x402Client().register(NETWORK, new ExactEvmScheme(evmSigner));

const fetchWithPayment = wrapFetchWithPayment(fetch, paymentClient);

const requestBody = {
  token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  signals: ["liquidity", "volume", "price_impact", "wallet_flows"]
};

console.log("=== x402 Market Signal Buyer ===");
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

// Print payment/settlement headers when present
const xPaymentHeader = response.headers.get("x-payment");
const xPaymentResponse = response.headers.get("x-payment-response");

if (xPaymentHeader) {
  console.log(`X-Payment: ${xPaymentHeader}`);
}
if (xPaymentResponse) {
  console.log(`X-Payment-Response: ${xPaymentResponse}`);
}

const body = (await response.json()) as unknown;

console.log("\nResponse:");
console.log(JSON.stringify(body, null, 2));
