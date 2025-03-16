/**
 * Chain IDs for EVM-compatible chains.
 * Non-EVM chains are `undefined`.
 */
export const CHAIN_IDS: Record<string, number | undefined> = {
  eth: 1,
  near: undefined,
  base: 8453,
  arbitrum: 42161,
  bitcoin: undefined,
  solana: undefined,
  dogecoin: undefined,
  turbochain: 1313161567,
  aurora: 1313161554,
  xrpledger: undefined,
  zcash: undefined,
  gnosis: 100,
  berachain: 80094,
};

/**
 * Chain IDs for EVM-compatible chains.
 * Non-EVM chains are `undefined`.
 */
export const CHAIN_NAMES: Record<string, string | undefined> = {
  eth: "Ethereum",
  near: undefined,
  base: "Base",
  arbitrum: "Arbitrum",
  bitcoin: undefined,
  solana: undefined,
  dogecoin: undefined,
  turbochain: "Turbochain",
  aurora: "Aurora",
  xrpledger: undefined,
  zcash: undefined,
  gnosis: "Gnosis",
  berachain: "Berachain",
};
