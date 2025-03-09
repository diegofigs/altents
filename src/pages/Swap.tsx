import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MdOutlineSwapVert } from "react-icons/md";
import { toast } from "react-toastify";
import { useAccount } from "wagmi";
import { SplashScreen } from "../components/SplashScreen";
import { TokenSelect } from "../components/TokenSelect";
import { config } from "../config";
import {
  AggregatedAsset,
  fetchQuote,
  fetchTokens,
  getDepositedBalances,
  publishIntent,
  Token,
} from "../core";
import { getUnifiedTokenList, UnifiedAsset } from "../core/tokens";
import { formatFixedPoint, limitDecimals } from "../core/utils";

const tokenList = getUnifiedTokenList().reduce<Record<string, UnifiedAsset>>(
  (acc, asset) => ({
    ...acc,
    [asset.defuse_asset_id]: asset,
  }),
  {},
);

export function Swap() {
  const account = useAccount();
  const address = account.address?.toLowerCase() || "";
  const {
    data: assets,
    isFetching: isFetchingAssets,
    error: errorAssets,
  } = useQuery({
    queryKey: ["tokens"],
    queryFn: fetchTokens,
    initialData: [],
  });

  const platformAssets = useMemo(() => {
    const assetsById = assets.reduce<Record<string, Token>>((acc, asset) => {
      return {
        ...acc,
        [asset.defuse_asset_id]: asset,
      };
    }, {});
    // Combine chain data (prices, deposit addresses, etc.) with official data
    return [...Object.values(tokenList)]
      .sort(({ chainName: chainNameA = "" }, { chainName: chainNameB = "" }) =>
        chainNameA < chainNameB ? -1 : chainNameA > chainNameB ? 1 : 0,
      )
      .map<AggregatedAsset>((asset) => ({
        ...assetsById[asset.defuse_asset_id],
        ...asset,
      }));
  }, [assets]);

  const { data: balances } = useQuery({
    queryKey: ["balances", address],
    queryFn: () =>
      getDepositedBalances(
        address,
        assets.map((asset) => asset.defuse_asset_id),
      ),
    enabled: assets.length > 0 && address !== "",
  });

  // ------------------------
  // State variables
  // ------------------------
  const [amountIn, setAmountIn] = useState("1");

  // Default token IDs (USDC in, NEAR out)
  const [inputTokenId, setInputTokenId] = useState(
    "nep141:aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near",
  );
  const [outputTokenId, setOutputTokenId] = useState(
    "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  );

  const assetIn = useMemo(
    () =>
      platformAssets.find((asset) => asset.defuse_asset_id === inputTokenId),
    [platformAssets, inputTokenId],
  );
  const assetOut = useMemo(
    () =>
      platformAssets.find((asset) => asset.defuse_asset_id === outputTokenId),
    [platformAssets, outputTokenId],
  );

  const balanceAssetIn = useMemo(() => {
    if (balances && assetIn) {
      const bigBal = balances[assetIn.defuse_asset_id];
      if (bigBal) {
        return limitDecimals(formatFixedPoint(bigBal, assetIn.decimals), 2);
      }
    }
    return "0";
  }, [assetIn, balances]);

  const balanceAssetOut = useMemo(() => {
    if (balances && assetOut) {
      const bigBal = balances[assetOut.defuse_asset_id];
      if (bigBal) {
        return limitDecimals(formatFixedPoint(bigBal, assetOut.decimals), 2);
      }
    }
    return "0";
  }, [assetOut, balances]);

  const handleMaxClick = () => {
    // Use the exact numeric balance if available
    const max = parseFloat(balanceAssetIn);
    if (!isNaN(max)) {
      // Overwrite the “From” amount with the user’s entire balance
      setAmountIn(String(max));
    }
  };
  const handleHalfClick = () => {
    const max = parseFloat(balanceAssetIn);
    if (!isNaN(max)) {
      // Overwrite with half
      setAmountIn(String(max / 2));
    }
  };

  const handleSwapTokens = () => {
    const temp = inputTokenId;
    setInputTokenId(outputTokenId);
    setOutputTokenId(temp);
  };

  const { data: quote, isLoading: isLoadingQuote } = useQuery({
    queryKey: ["quote", amountIn, inputTokenId, outputTokenId],
    queryFn: async () => {
      if (!assetIn) return null;
      return fetchQuote({
        inputTokenId,
        outputTokenId,
        exactAmountIn: BigInt(
          parseFloat(amountIn) * 10 ** (assetIn.decimals || 1),
        ).toString(),
      });
    },
    enabled: !!assetIn && parseFloat(amountIn) > 0,
  });

  const handleSwap = async () => {
    if (!address) {
      toast.error("Connect your wallet first.");
      return;
    }
    if (!quote) {
      toast.error("No quote available.");
      return;
    }

    try {
      await publishIntent({
        config,
        address,
        quote,
        inputTokenId,
        outputTokenId,
      });
      toast.success("Swap intent published successfully!");
    } catch (err) {
      if (err instanceof Error) {
        toast.error(`Failed to publish swap intent: ${err.message}`);
      }
    }
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

  return (
    <main className="h-full flex-grow flex items-center justify-center px-4 py-8">
      <div
        className="w-full max-w-lg bg-gray-700 rounded-2xl shadow-lg p-8 space-y-6"
        role="form"
        aria-label="Swap Form"
      >
        {/* FROM SECTION */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {/* Amount In */}
          <div className="flex flex-col">
            <label
              htmlFor="amountIn"
              className="block text-sm font-medium text-gray-400"
            >
              Amount In
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
            <p className="mt-1 text-sm text-gray-400 truncate">
              {/* Example price logic (if you have assetIn.price) */}
              ~${(parseFloat(amountIn) * (assetIn?.price || 0)).toFixed(2)}
            </p>
          </div>

          {/* Token In */}
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-400">
              Token
            </label>
            <TokenSelect
              options={platformAssets}
              selected={inputTokenId}
              onChange={setInputTokenId}
            />
            {/* Balance + Max/Half buttons */}
            <p className="mt-1 text-sm text-gray-400">
              Balance: {balanceAssetIn}
              {/* "Max" & "50%" buttons */}
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

        {/* SWAP TOKENS BUTTON */}
        <div className="flex items-center justify-center mt-4">
          <button
            onClick={handleSwapTokens}
            className="w-10 h-10 relative rounded-full bg-gray-800 
                flex items-center justify-center hover:bg-gray-500 focus:outline-2"
            aria-label="Swap input and output tokens"
          >
            <MdOutlineSwapVert className="absolute h-6 w-6 text-gray-300" />
          </button>
        </div>

        {/* TO SECTION */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-4">
          {/* Amount Out (read-only) */}
          <div className="flex flex-col">
            <label
              htmlFor="amountOut"
              className="block text-sm font-medium text-gray-400"
            >
              Amount Out
            </label>
            <div
              id="amountOut"
              className="mt-2 w-full text-2xl font-semibold text-gray-100 
                  bg-transparent border-b border-gray-600 pb-2 truncate"
            >
              {quote?.amount_out && assetOut?.decimals
                ? parseInt(quote.amount_out) / 10 ** assetOut.decimals
                : "0.0"}
            </div>
            <p className="mt-1 text-sm text-gray-400 truncate">
              ~$
              {quote?.amount_out && assetOut
                ? (
                    (parseInt(quote.amount_out) / 10 ** assetOut.decimals) *
                    (assetOut.price || 0)
                  ).toFixed(2)
                : "0.0"}
            </p>
          </div>

          {/* Token Out */}
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-400">
              Token
            </label>
            <TokenSelect
              options={platformAssets}
              selected={outputTokenId}
              onChange={setOutputTokenId}
            />
            <p className="mt-1 text-sm text-gray-400">
              Balance: {balanceAssetOut}
            </p>
          </div>
        </div>

        {/* SWAP BUTTON */}
        <button
          onClick={handleSwap}
          disabled={!address}
          className="w-full py-3 mt-6 rounded-full text-lg font-semibold text-gray-100 
              bg-gradient-to-r from-blue-500 to-blue-600 
              hover:from-blue-600 hover:to-blue-700 focus:outline-none 
              focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-colors 
              disabled:opacity-50"
        >
          Swap
        </button>

        {/* QUOTE STATUS */}
        <div className="mt-3">
          {isLoadingQuote ? (
            <p className="text-sm text-gray-400">Fetching quote...</p>
          ) : !quote ? (
            <p className="text-sm text-gray-400">No quote available.</p>
          ) : (
            <p className="text-sm text-gray-300">
              Expires at: {new Date(quote.expiration_time).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
