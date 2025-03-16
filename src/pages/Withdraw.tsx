import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { formatUnits, isAddress, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { SelectWithIcon } from "../components/SelectWithIcon";
import { config } from "../config";
import {
  getDepositedBalances,
  pollIntentStatus,
  publishWithdrawIntent,
} from "../core";
import { CHAIN_NAMES } from "../core/evm";
import { usePlatformAssets } from "../hooks/usePlatformAssets";
import { Route as withdrawRoute } from "../routes/withdraw";
import { toast } from "react-toastify";

export function Withdraw() {
  const account = useAccount();
  const address = account.address?.toLowerCase() || "";
  const assets = withdrawRoute.useLoaderData();

  const platformAssets = usePlatformAssets(assets);

  const { data: balances } = useQuery({
    queryKey: ["balances", address],
    queryFn: () =>
      getDepositedBalances(
        address,
        (assets || []).map((asset) => `nep141:${asset.near_token_id}`),
        // (assets || []).map((asset) => `nep141:${asset.near_token_id}`),
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

  const selectedAggregatedSymbol = useMemo(() => {
    return platformAssets.find((item) => item.symbol === selectedSymbol);
  }, [platformAssets, selectedSymbol]);

  const chainOptions = useMemo(
    () => selectedAggregatedSymbol?.chainVariants || [],
    [selectedAggregatedSymbol?.chainVariants],
  );

  // If user hasn’t picked a chain yet, default to the first in the array
  if (!selectedDefuseAssetId && chainOptions.length) {
    setSelectedDefuseAssetId(chainOptions[0].defuseAssetId);
  }

  const selectedChainVariant = useMemo(() => {
    return chainOptions.find((c) => c.defuseAssetId === selectedDefuseAssetId);
  }, [chainOptions, selectedDefuseAssetId]);

  const protocolBalance = useMemo(() => {
    if (balances && selectedAggregatedSymbol && selectedChainVariant) {
      const balance =
        balances[
          selectedAggregatedSymbol.parentDefuseAssetId ||
            selectedChainVariant.defuseAssetId
        ];
      if (balance) {
        return formatUnits(balance, selectedChainVariant.decimals);
      }
    }
    return "0";
  }, [balances, selectedChainVariant, selectedAggregatedSymbol]);

  const handleMaxClick = () => {
    const max = parseFloat(protocolBalance);
    if (!isNaN(max)) {
      setAmountIn(String(max));
    }
  };

  const handleHalfClick = () => {
    const max = parseFloat(protocolBalance);
    if (!isNaN(max)) {
      setAmountIn(String(max / 2));
    }
  };

  const handleWithdraw = async () => {
    if (
      amountIn &&
      selectedAggregatedSymbol &&
      selectedChainVariant &&
      isAddress(address)
    ) {
      const res = await publishWithdrawIntent({
        config,
        nearToken: selectedChainVariant.nearTokenId,
        address,
        amount: parseUnits(amountIn, selectedChainVariant.decimals).toString(),
      });
      if (res && res.status === "OK") {
        pollIntentStatus(res.intent_hash);
      } else {
        toast.error("Failed to publish withdraw intent.");
      }
    }
  };

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
          </div>
        </div>

        {/* CHAIN SELECTION (if multiple grouped tokens exist) */}
        {chainOptions && (
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-400">
              Chain
            </label>
            <SelectWithIcon
              options={chainOptions.map((variant) => ({
                id: variant.defuseAssetId,
                name:
                  (variant.chainName && CHAIN_NAMES[variant.chainName]) || "",
                icon: variant.chainIcon || "",
              }))}
              selected={selectedDefuseAssetId || chainOptions[0].defuseAssetId}
              onChange={setSelectedDefuseAssetId}
            />

            {/* Balance + Max/Half buttons */}
            <p className="mt-1 text-sm text-gray-400">
              Balance: {protocolBalance}
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
        )}

        {/* DEPOSIT BUTTON */}
        <button
          onClick={handleWithdraw}
          disabled={!address || !selectedChainVariant}
          className="w-full py-3 mt-6 rounded-full text-lg font-semibold text-gray-100 
            bg-gradient-to-r from-blue-500 to-blue-600 
            hover:from-blue-600 hover:to-blue-700 focus:outline-none 
            focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-colors 
            disabled:opacity-50"
        >
          Withdraw
        </button>
      </div>
    </main>
  );
}
