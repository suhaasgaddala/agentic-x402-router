import type { AddressInfo } from "node:net";
import http from "node:http";

/**
 * Spins up a minimal in-process facilitator stub that responds to GET /supported.
 * Passes the server URL to `test`, then tears the server down before returning.
 * No real network calls are made — the stub binds on 127.0.0.1 with a random port.
 */
export async function withFakeFacilitator<T>(test: (url: string) => Promise<T>): Promise<T> {
  const server = http.createServer((req, res) => {
    if (req.url === "/supported") {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:84532" }],
          extensions: [],
          signers: {}
        })
      );
      return;
    }

    res.statusCode = 404;
    res.end("not found");
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address() as AddressInfo;

  try {
    return await test(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
