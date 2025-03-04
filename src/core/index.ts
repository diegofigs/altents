import { JsonRpcProvider } from "near-api-js/lib/providers";
import { CodeResult } from "near-api-js/lib/providers/provider";
import assert from "node:assert";
import { Config } from "wagmi";
import { signMessage } from "wagmi/actions";
import { generateNonce, transformERC191Signature } from "./utils";

export interface Token {
  blockchain: string;
  contract_address: string;
  decimals: number;
  defuse_asset_id: string;
  price: number;
  price_updated_at: string;
  symbol: string;
}

export interface Quote {
  quote_hash: string;
  defuse_asset_identifier_in: string;
  defuse_asset_identifier_out: string;
  amount_in: string;
  amount_out: string;
  expiration_time: string; // UNIX timestamp as a string
}

interface JsonRpcRequest {
  id: string;
  jsonrpc: string;
  method: string;
  params: unknown[];
}
interface JsonRpcError {
  message: string;
  code?: number;
}
interface JsonRpcResponse<T> {
  id: number;
  jsonrpc: string;
  result?: T;
  error?: JsonRpcError;
}

/**
 * Helper function to send JSON‑RPC requests
 * to the Chaindefuser Bridge at https://bridge.chaindefuser.com/rpc
 */
export async function sendJsonRpcRequest<T>(
  method: string,
  params: unknown,
): Promise<T> {
  const body: JsonRpcRequest = {
    id: "dontcare",
    jsonrpc: "2.0",
    method,
    params: [params],
  };

  try {
    const response = await fetch(
      "https://solver-relay-v2.chaindefuser.com/rpc",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    const data: JsonRpcResponse<T> = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "Unknown RPC error");
    }
    if (!data.result) {
      throw new Error("No result returned from RPC");
    }
    return data.result;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error calling ${method}:`, error);
    }
    throw error;
  }
}

export async function fetchTokens(): Promise<Token[]> {
  try {
    const response = await fetch(
      "https://api-mng-console.chaindefuser.com/api/tokens",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    const data = await response.json();

    return data.items;
  } catch (error) {
    console.error(`Error calling Tokens API:`, error);
    throw error;
  }
}

export async function fetchCoingeckoPrice(assetId: string) {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${assetId}&vs_currencies=usd`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-cg-demo-api-key": import.meta.env.VITE_COINGECKO_API_KEY,
        },
      },
    );
    const data = await response.json();
    return data[assetId].usd;
  } catch (e) {
    console.error(`Error calling CG: ${e}`);
    return 0;
  }
}

type FetchQuoteParams = {
  inputTokenId: string;
  outputTokenId: string;
  exactAmountIn: string;
};

export async function fetchQuote({
  inputTokenId,
  outputTokenId,
  exactAmountIn,
}: FetchQuoteParams) {
  try {
    const params = {
      defuse_asset_identifier_in: inputTokenId,
      defuse_asset_identifier_out: outputTokenId,
      exact_amount_in: exactAmountIn,
    };
    const quoteResponse = await sendJsonRpcRequest<Quote[]>("quote", params);
    if (quoteResponse && quoteResponse.length > 0) {
      return quoteResponse[0];
    }
  } catch (err) {
    console.warn(err);
  }
}

type PublishIntentParams = {
  config: Config;
  inputTokenId: string;
  outputTokenId: string;
  quote: Quote | undefined;
  address: string;
};

interface PublishIntentResponse {
  status: "OK" | "FAILED";
  reason?: string;
  intent_hash: string;
}

export async function publishIntent({
  config,
  inputTokenId,
  outputTokenId,
  quote,
  address,
}: PublishIntentParams) {
  try {
    const quoteHash = quote?.quote_hash;
    const signerId = address.toLowerCase();
    const nonce = await generateNonce(signerId);
    const message = {
      signer_id: signerId,
      verifying_contract: "intents.near",
      deadline: quote?.expiration_time,
      nonce,
      intents: [
        {
          intent: "token_diff",
          diff: {
            [inputTokenId]: `-${quote?.amount_in}`,
            [outputTokenId]: quote?.amount_out,
          },
        },
      ],
    };
    const messageStr = JSON.stringify(message, null, 2);
    const signature = await signMessage(config, {
      message: messageStr,
    });
    const intentParams = {
      quote_hashes: [quoteHash],
      signed_data: {
        standard: "erc191",
        payload: messageStr,
        signature: transformERC191Signature(signature),
      },
    };

    const response = await sendJsonRpcRequest<PublishIntentResponse>(
      "publish_intent",
      intentParams,
    );
    if (response.status === "OK") {
      console.log("Swap intent published successfully!");
    } else {
      console.warn(`Swap failed: ${response.reason || "Unknown error"}`);
    }
  } catch (err) {
    console.error(`Failed to publish swap intent: ${err}`);
  }
}

type TokenBalances = Record<string, bigint>;

export async function getDepositedBalances(
  address: string,
  tokenIds: string[],
): Promise<TokenBalances> {
  const nearClient = new JsonRpcProvider({ url: "https://nearrpc.aurora.dev" });
  // RPC call
  // Warning: `CodeResult` is not correct type for `call_function`, but it's closest we have.
  const output = await nearClient.query<CodeResult>({
    request_type: "call_function",
    account_id: "intents.near",
    method_name: "mt_batch_balance_of",
    args_base64: btoa(
      JSON.stringify({
        account_id: address.toLowerCase(),
        token_ids: tokenIds,
      }),
    ),
    finality: "optimistic",
  });

  // Decoding response
  const uint8Array = new Uint8Array(output.result);
  const decoder = new TextDecoder();
  const parsed = JSON.parse(decoder.decode(uint8Array));

  // Validating response
  assert(
    Array.isArray(parsed) && parsed.every((a) => typeof a === "string"),
    "Invalid response",
  );
  assert(parsed.length === tokenIds.length, "Invalid response");

  // Transforming response
  const result: TokenBalances = {};
  for (let i = 0; i < tokenIds.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: always within bounds
    result[tokenIds[i]!] = BigInt(parsed[i]);
  }

  return result;
}
