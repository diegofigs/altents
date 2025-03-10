import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { SplashScreen } from "../components/SplashScreen";
import {
  BridgeableAsset,
  getDepositAddress,
  getDepositedBalances,
  getSupportedTokens,
} from "../core";
import { getUnifiedTokenList } from "../core/tokens";
import { formatFixedPoint, limitDecimals } from "../core/utils";
import { SelectWithIcon } from "../components/SelectWithIcon";
import { useReadErc20 } from "../generated";
import { Address } from "viem";

// Chains you want to filter by:
const chains = ["eth:1", "eth:8453", "eth:42161", "eth:100", "eth:80094"];

// The structure we ultimately want for each symbol
// e.g., 'USDC' => { parent info, chainVariants: [ { chainName, chainIcon, decimals, address } ] }
interface ChainVariant {
  defuseAssetId: string;
  chainName: string;
  chainIcon?: string;
  address: string;
  decimals: number;
}

interface AggregatedSymbol {
  symbol: string;
  name: string;
  icon?: string;
  // The top-level parent or "unified token" data
  parentDefuseAssetId?: string; // In case you want to store it
  decimals: number; // default
  chainVariants: ChainVariant[];
}

export function Deposit() {
  const account = useAccount();
  const address = account.address?.toLowerCase() || "";

  // 1) Official local token list
  const tokenList = getUnifiedTokenList(); // e.g., USDC, NEAR, etc.

  // 2) Fetch tokens from bridge => BridgeableAsset[]
  const {
    data: assets,
    isFetching: isFetchingAssets,
    error: errorAssets,
  } = useQuery({
    queryKey: ["supportedTokens"],
    queryFn: () => getSupportedTokens({ chains }),
    initialData: [],
  });

  // 3) Build the final structure: AggregatedSymbol[]
  const platformAssets = useMemo<AggregatedSymbol[]>(() => {
    if (!assets?.length) return [];

    // 3a) For each returned BridgeableAsset, find the local parent token & correct groupedToken
    const matched = assets.map((bridgeAsset) => {
      const [chainType, chainId, address] =
        bridgeAsset.defuse_asset_identifier.split(":");

      // 1) Find the parent token in your official list
      //    (the one containing `groupedTokens` that match the near_token_id or defuseAssetId).
      const parentToken = tokenList.find((parent) => {
        // If parent's top-level defuseAssetId matches, or if parent's groupedTokens has a match
        if (parent.defuse_asset_id === `nep141:${bridgeAsset.near_token_id}`) {
          return true;
        }
        // Or if parent's groupedTokens contain a match
        return parent.groupedTokens?.some(
          (gT) => gT.defuseAssetId === `nep141:${bridgeAsset.near_token_id}`,
        );
      });

      if (!parentToken) {
        // No match: return null so we can filter it out
        return null;
      }

      // 2) Among parent's groupedTokens, find the *exact chain variant* that corresponds
      //    to the current defuse_asset_identifier or near_token_id
      //    (We want the chainName, chainIcon, etc. from the grouped token)
      let exactGroupedToken = parentToken.groupedTokens?.find(
        (gT) => gT.defuseAssetId === `nep141:${bridgeAsset.near_token_id}`,
      );

      // If parentToken itself had no groupedTokens or none matched,
      // fallback to the parent if it directly has defuseAssetId
      if (!exactGroupedToken && parentToken.defuse_asset_id) {
        if (
          parentToken.defuse_asset_id === `nep141:${bridgeAsset.near_token_id}`
        ) {
          // We'll "fake" a grouped token from the parent data
          exactGroupedToken = {
            defuseAssetId: parentToken.defuse_asset_id,
            chainId: chainId,
            chainName: parentToken.chainName || "",
            chainIcon: parentToken.icon || "",
            icon: parentToken.icon || "",
            symbol: parentToken.symbol,
            name: parentToken.name,
            decimals: parentToken.decimals,
            address: parentToken.address || "", // or fill from the BridgeableAsset
            routes: [],
          };
        }
      }

      if (!exactGroupedToken) {
        return null;
      }

      return {
        ...bridgeAsset,
        chainType,
        chainId,
        address,
        _parent: parentToken, // store entire parent if you want
        _grouped: exactGroupedToken, // store the matched chain variant
      };
    });

    // Filter out nulls if no match
    const matchedClean = matched.filter(Boolean) as Array<
      BridgeableAsset & {
        chainType: string;
        chainId: string;
        address: string;
        _parent: (typeof tokenList)[number];
        _grouped: NonNullable<
          (typeof tokenList)[number]["groupedTokens"]
        >[number];
      }
    >;

    // 3b) Aggregate by symbol => AggregatedSymbol
    //    i.e., all chain variants for a single symbol
    //    so user can pick {symbol} then pick chain from chainVariants
    const map: Record<string, AggregatedSymbol> = {};

    matchedClean.forEach((item) => {
      const symbol = item._parent.symbol;
      if (!map[symbol]) {
        map[symbol] = {
          symbol,
          name: item._parent.name,
          icon: item._parent.icon,
          decimals: item._parent.decimals || 18,
          parentDefuseAssetId: item._parent.defuse_asset_id,
          chainVariants: [],
        };
      }
      // Add the chain variant
      map[symbol].chainVariants.push({
        defuseAssetId: item.defuse_asset_identifier,
        chainName: item._grouped.chainName,
        chainIcon: item._grouped.chainIcon,
        address: item._grouped.address || "",
        decimals: item._grouped.decimals,
      });
    });

    // Return as a sorted array
    return Object.values(map).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [assets, tokenList]);

  // 4) Balances query
  const { data: balances } = useQuery({
    queryKey: ["balances", address],
    queryFn: () =>
      getDepositedBalances(
        address,
        (assets || []).map((asset) => asset.defuse_asset_identifier),
      ),
    enabled: !!assets && assets.length > 0 && address !== "",
  });

  // ------------------------
  // State variables for the user’s picks
  // ------------------------
  const [amountIn, setAmountIn] = useState("1");

  // We'll have two dropdowns:
  //   1) which symbol
  //   2) which chain variant
  const [selectedSymbol, setSelectedSymbol] = useState("ETH");
  const [selectedDefuseAssetId, setSelectedDefuseAssetId] = useState<
    string | null
  >(null);

  // 5) Find the AggregatedSymbol for the selected symbol
  const currentSymbolData = useMemo(() => {
    return platformAssets.find((item) => item.symbol === selectedSymbol);
  }, [platformAssets, selectedSymbol]);

  // 6) The chain dropdown options, if any
  const chainOptions = useMemo(
    () => currentSymbolData?.chainVariants || [],
    [currentSymbolData?.chainVariants],
  );

  // If user hasn’t picked a chain yet, default to the first in the array
  if (!selectedDefuseAssetId && chainOptions.length) {
    setSelectedDefuseAssetId(chainOptions[0].defuseAssetId);
  }

  // 7) The chain variant object the user actually picked
  const currentChainVariant = useMemo(() => {
    return chainOptions.find((c) => c.defuseAssetId === selectedDefuseAssetId);
  }, [chainOptions, selectedDefuseAssetId]);

  // 8) Compute balance (example: from “balances”)
  //    You’d do something like: balances?.[the chosen defuse asset id]
  const balanceAssetIn = useMemo(() => {
    if (balances && currentChainVariant) {
      const bigBal = balances[currentChainVariant.defuseAssetId];
      if (bigBal) {
        return limitDecimals(
          formatFixedPoint(bigBal, currentChainVariant.decimals),
          2,
        );
      }
    }
    return "0";
  }, [balances, currentChainVariant]);

  const { data: depositAddress } = useQuery({
    queryKey: ["depositAddress", selectedDefuseAssetId],
    queryFn: () => {
      if (selectedDefuseAssetId) {
        const [chainType, chainId] = selectedDefuseAssetId.split(":");
        return getDepositAddress({
          accountId: address,
          chain: `${chainType}:${chainId}`,
        });
      }
    },
    enabled: selectedDefuseAssetId !== null,
  });

  const { data } = useReadErc20({
    address: address as Address,
    functionName: "balanceOf",
    args: ["0xA0Cf798816D4b9b9866b5330EEa46a18382f251e"],
  });

  // 9) Button logic
  const handleMaxClick = () => {
    const max = parseFloat(balanceAssetIn);
    if (!isNaN(max)) {
      setAmountIn(String(max));
    }
  };
  const handleHalfClick = () => {
    const max = parseFloat(balanceAssetIn);
    if (!isNaN(max)) {
      setAmountIn(String(max / 2));
    }
  };

  // 10) e.g., deposit action
  const handleDeposit = () => {
    // TODO: Actually deposit with the chosen chain + defuseAssetId
    console.log(
      "Depositing",
      amountIn,
      "of",
      selectedSymbol,
      "on chain variant:",
      currentChainVariant,
    );
  };

  if (isFetchingAssets) {
    return <SplashScreen />;
  }

  if (errorAssets) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-800">
        <p className="text-red-400 font-semibold text-lg">
          Error: {String(errorAssets)}
        </p>
      </div>
    );
  }

  console.log(selectedSymbol, selectedDefuseAssetId, depositAddress);

  return (
    <main className="h-full flex-grow flex items-center justify-center px-4 py-8">
      <div
        className="w-full max-w-lg bg-gray-700 rounded-2xl shadow-lg p-8 space-y-6"
        role="form"
        aria-label="Deposit Form"
      >
        {/* AMOUNT */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div className="flex flex-col">
            <label
              htmlFor="amountIn"
              className="block text-sm font-medium text-gray-400"
            >
              Amount
            </label>
            <input
              id="amountIn"
              type="number"
              inputMode="decimal"
              placeholder="Enter amount"
              aria-label="Input amount"
              className="mt-1 w-full text-2xl font-semibold text-gray-100 
                py-2 px-3 rounded-md bg-gray-800 border-b border-gray-600 pb-2 
                focus:outline-none focus:border-blue-500 transition-colors"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
            />
          </div>

          {/* TOKEN SELECTION (by symbol) */}
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-400">
              Token
            </label>
            {platformAssets.length > 0 && (
              <SelectWithIcon
                options={platformAssets.map((item) => ({
                  id: item.symbol,
                  icon: item.icon || "",
                  name: item.symbol,
                }))}
                selected={selectedSymbol}
                onChange={(val) => {
                  setSelectedSymbol(val);
                  // Reset chain selection
                  setSelectedDefuseAssetId(null);
                }}
              />
            )}
            {/* Balance + Max/Half buttons */}
            <p className="mt-1 text-sm text-gray-400">
              Balance: {balanceAssetIn}
              <button
                onClick={handleMaxClick}
                className="ml-2 text-xs text-blue-300 bg-gray-500 cursor-pointer
                  px-2 py-0.5 rounded hover:bg-gray-800 focus:outline-2"
              >
                MAX
              </button>
              <button
                onClick={handleHalfClick}
                className="ml-2 text-xs text-blue-300 bg-gray-500 cursor-pointer
                  px-2 py-0.5 rounded hover:bg-gray-800 focus:outline-2"
              >
                50%
              </button>
            </p>
          </div>
        </div>

        {/* CHAIN SELECTION (if multiple grouped tokens exist) */}
        {!!chainOptions.length && (
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-400">
              Chain
            </label>
            <SelectWithIcon
              options={chainOptions.map((variant) => ({
                id: variant.defuseAssetId,
                name: variant.chainName,
                icon: variant.chainIcon || "",
              }))}
              selected={selectedDefuseAssetId || chainOptions[0].defuseAssetId}
              onChange={setSelectedDefuseAssetId}
            />
          </div>
        )}

        {/* DEPOSIT BUTTON */}
        <button
          onClick={handleDeposit}
          disabled={!address || !currentChainVariant}
          className="w-full py-3 mt-6 rounded-full text-lg font-semibold text-gray-100 
            bg-gradient-to-r from-blue-500 to-blue-600 
            hover:from-blue-600 hover:to-blue-700 focus:outline-none 
            focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-colors 
            disabled:opacity-50"
        >
          Deposit
        </button>
      </div>
    </main>
  );
}
