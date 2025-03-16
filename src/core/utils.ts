import { base58, hex } from "@scure/base";
import crypto from "crypto";
import * as nearAPI from "near-api-js";

export const generateNonce = async (accountId: string): Promise<string> => {
  const randomArray = crypto.randomBytes(32);
  const nonceString = randomArray.toString("base64");
  if (await isNonceUsed(accountId, nonceString)) {
    //this step can be skipped but if nonce is already used quote wont be taken into account
    return generateNonce(accountId);
  } else {
    return nonceString;
  }
};

const isNonceUsed = async (accountId: string, nonce: string) => {
  const account = await getAccount(accountId); //function that will return Account instance(from "near-api-js") of solver Near account
  return await account.viewFunction({
    contractId: "intents.near",
    methodName: "is_nonce_used",
    args: {
      account_id: account.accountId,
      nonce,
    },
  });
};

const getAccount = async (accountId: string) => {
  const conn = await getNearConnection();
  return await conn.account(accountId);
};

let connection: nearAPI.Near;
export const getNearConnection = async () => {
  if (connection) {
    return connection;
  }
  const { keyStores } = nearAPI;
  const myKeyStore = new keyStores.BrowserLocalStorageKeyStore();
  const connectionConfig = {
    networkId: "mainnet",
    keyStore: myKeyStore,
    nodeUrl: "https://rpc.mainnet.near.org",
  };
  connection = await nearAPI.connect(connectionConfig);
  return connection;
};

function toRecoveryBit(yParityOrV: number) {
  if (yParityOrV === 0 || yParityOrV === 1) return yParityOrV;
  if (yParityOrV === 27) return 0;
  if (yParityOrV === 28) return 1;
  throw new Error("Invalid yParityOrV value");
}

function normalizeERC191Signature(signature: string): string {
  // Get `v` from the last two characters
  let v = Number.parseInt(signature.slice(-2), 16);

  // // Normalize `v` to be either 0 or 1
  v = toRecoveryBit(v);

  // Convert `v` back to hex
  const vHex = v.toString(16).padStart(2, "0");

  // Reconstruct the full signature with the adjusted `v`
  return signature.slice(0, -2) + vHex;
}

export function transformERC191Signature(signature: string) {
  const normalizedSignature = normalizeERC191Signature(signature);
  const bytes = hex.decode(
    normalizedSignature.startsWith("0x")
      ? normalizedSignature.slice(2)
      : normalizedSignature,
  );
  return `secp256k1:${base58.encode(bytes)}`;
}

export function formatFixedPoint(value: bigint, decimals: number) {
  // Convert the BigInt to a string.
  let str = value.toString();
  if (str === "0") {
    return str;
  }

  // If the string length is less than or equal to the decimals,
  // we need to pad the string with leading zeros.
  if (str.length <= decimals) {
    // Pad with zeros so that we have exactly 'decimals' digits for the fractional part.
    str = str.padStart(decimals, "0");
    // Prepend "0." since there's no integer part.
    return "0." + str;
  } else {
    // Split the string into the integer and fractional parts.
    const integerPart = str.slice(0, str.length - decimals);
    const fractionalPart = str.slice(str.length - decimals);
    return integerPart + "." + fractionalPart;
  }
}

/**
 * Limits the number of decimal places in a fixed-point string.
 *
 * @param value - The fixed-point formatted string (e.g. "123.456789").
 * @param maxDecimals - The maximum number of decimals to display.
 * @returns The fixed-point string with its fractional part truncated to the specified max decimals.
 *
 * Examples:
 *   limitDecimals("123.456789", 2) returns "123.45"
 *   limitDecimals("123.4", 2) returns "123.4"
 *   limitDecimals("123", 2) returns "123"
 */
export function limitDecimals(value: string, maxDecimals: number): string {
  const [integerPart, fractionalPart] = value.split(".");

  // If there's no fractional part, return the value as is.
  if (!fractionalPart) {
    return value;
  }

  // Limit the fractional part to the desired length.
  const limitedFraction = fractionalPart.slice(0, maxDecimals);

  // If the limited fraction is empty (i.e. it was "0" or something similar), return just the integer part.
  return limitedFraction ? `${integerPart}.${limitedFraction}` : integerPart;
}
