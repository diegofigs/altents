import type { BridgeableToken } from "../core";
import type { UnifiedAsset } from "../core/tokens";

import { useMemo } from "react";
import { getUnifiedTokenList } from "../core/tokens";

const tokenList = getUnifiedTokenList(); // local official list

export function usePlatformAssets(
  bridgeAssets: BridgeableToken[] | undefined,
): AggregatedSymbol[] {
  return useMemo(() => {
    if (!bridgeAssets?.length) return [];

    // 1) Map each BridgeableAsset => { symbol, chainVariant } or null
    const mapped = bridgeAssets
      .map((bA) => mapBridgeAssetToSymbol(bA, tokenList))
      .filter((m) => m !== null) as SymbolChainMapping[];

    // 2) Group them by symbol
    return groupBySymbol(mapped);
  }, [bridgeAssets]);
}

interface ChainVariant {
  defuseAssetId: string;
  chainName?: string;
  chainIcon?: string;
  decimals: number;
  address: string; // the chain-specific address
  nearTokenId: string;
}

interface SymbolChainMapping {
  chainType: string;
  symbol: string;
  name?: string;
  icon?: string;
  parentDefuseAssetId?: string;
  chainVariant: ChainVariant;
}

export function mapBridgeAssetToSymbol(
  bridgeAsset: BridgeableToken,
  tokenList: UnifiedAsset[],
): SymbolChainMapping | null {
  const [chainType, chainId, chainAddress] =
    bridgeAsset.defuse_asset_identifier.split(":");

  // 1) Find the “parent” local token
  const parentToken = tokenList.find((local) => {
    // If local’s top-level defuseAssetId matches “nep141:bridgeAsset.near_token_id”
    if (local.defuse_asset_id === `nep141:${bridgeAsset.near_token_id}`) {
      return true;
    }
    // Or if local has groupedTokens containing that same defuseAssetId
    return local.groupedTokens?.some(
      (gT) => gT.defuseAssetId === `nep141:${bridgeAsset.near_token_id}`,
    );
  });

  if (!parentToken) return null;

  // 2) Among parent's groupedTokens, find the exact chain variant
  let exactGroupedToken = parentToken.groupedTokens?.find(
    (gT) => gT.defuseAssetId === `nep141:${bridgeAsset.near_token_id}`,
  );

  // If none found but parentToken itself might match
  if (!exactGroupedToken && parentToken.defuse_asset_id) {
    if (parentToken.defuse_asset_id === `nep141:${bridgeAsset.near_token_id}`) {
      // We'll create a grouped token from the parent data
      exactGroupedToken = {
        defuseAssetId: parentToken.defuse_asset_id,
        chainId: chainId,
        chainName: parentToken.chainName || "",
        chainIcon: parentToken.chainIcon || "",
        icon: parentToken.icon || "",
        symbol: parentToken.symbol,
        name: parentToken.name,
        decimals: parentToken.decimals,
        address: parentToken.address || "",
        routes: [],
      };
    }
  }

  if (!exactGroupedToken) return null;

  return {
    chainType,
    symbol: parentToken.symbol,
    name: parentToken.name,
    icon: parentToken.icon, // the parent’s icon
    parentDefuseAssetId: parentToken.defuse_asset_id,
    chainVariant: {
      defuseAssetId: bridgeAsset.defuse_asset_identifier, // the actual chain variant
      nearTokenId: bridgeAsset.near_token_id,
      chainName: exactGroupedToken.chainName,
      chainIcon: exactGroupedToken.chainIcon,
      decimals: exactGroupedToken.decimals,
      address: exactGroupedToken.address || chainAddress || "",
    },
  };
}

interface AggregatedSymbol {
  symbol: string;
  name?: string;
  icon?: string;
  parentDefuseAssetId?: string;
  chainVariants: {
    defuseAssetId: string;
    nearTokenId: string;
    chainName?: string;
    chainIcon?: string;
    decimals: number;
    address: string;
  }[];
}

/**
 * Takes an array of { symbol, chainVariant } and aggregates them into
 * an array of AggregatedSymbol. Each symbol can have multiple chainVariants.
 */
export function groupBySymbol(
  mapped: SymbolChainMapping[],
): AggregatedSymbol[] {
  const resultMap = new Map<string, AggregatedSymbol>();

  for (const item of mapped) {
    const existing = resultMap.get(item.symbol);
    if (!existing) {
      // We haven’t seen this symbol yet
      resultMap.set(item.symbol, {
        symbol: item.symbol,
        name: item.name,
        icon: item.icon,
        parentDefuseAssetId: item.parentDefuseAssetId,
        chainVariants: [item.chainVariant],
      });
    } else {
      // Symbol already exists => push one more chainVariant
      existing.chainVariants.push(item.chainVariant);
    }
  }

  // Return as a sorted array (e.g., alphabetical by symbol)
  return [...resultMap.values()].sort((a, b) =>
    a.symbol.localeCompare(b.symbol),
  );
}
