import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Address, formatUnits, isAddress, parseEther, parseUnits } from "viem";
import { useAccount, useBalance, useSendTransaction } from "wagmi";
import DepositAddressPanel from "../components/DepositAddressPanel";
import { SelectWithIcon } from "../components/SelectWithIcon";
import { getDepositAddress } from "../core";
import { CHAIN_NAMES } from "../core/evm";
import { useReadErc20, useWriteErc20Transfer } from "../generated";
import { usePlatformAssets } from "../hooks/usePlatformAssets";
import { useTxHashToast } from "../hooks/useTxHashToast";
import { Route as depositRoute } from "../routes/deposit";

export function Deposit() {
  const account = useAccount();
  const address = account.address?.toLowerCase() || "";
  const assets = depositRoute.useLoaderData();

  const platformAssets = usePlatformAssets(assets);

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

  const currentSymbolData = useMemo(() => {
    return platformAssets.find((item) => item.symbol === selectedSymbol);
  }, [platformAssets, selectedSymbol]);

  const chainOptions = useMemo(
    () => currentSymbolData?.chainVariants || [],
    [currentSymbolData?.chainVariants],
  );

  // If user hasn’t picked a chain yet, default to the first in the array
  if (!selectedDefuseAssetId && chainOptions.length) {
    setSelectedDefuseAssetId(chainOptions[0].defuseAssetId);
  }

  const currentChainVariant = useMemo(() => {
    return chainOptions.find((c) => c.defuseAssetId === selectedDefuseAssetId);
  }, [chainOptions, selectedDefuseAssetId]);

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
    enabled: selectedDefuseAssetId !== null && address !== "",
  });

  const selectedChainId =
    selectedDefuseAssetId && selectedDefuseAssetId.split(":").length === 3
      ? parseInt(selectedDefuseAssetId.split(":")[1])
      : 0;
  const { data: erc20Balance } = useReadErc20({
    address: (currentChainVariant?.address || "") as Address,
    chainId: selectedChainId ?? 1,
    functionName: "balanceOf",
    args: [address as Address],
  });

  const { data: nativeBalance } = useBalance({
    address: address as Address,
    chainId: selectedChainId ?? 1,
  });

  const { data: sendErc20TransferHash, writeContract: sendErc20Transfer } =
    useWriteErc20Transfer();
  useTxHashToast(sendErc20TransferHash);

  const { data: sendNativeTransferHash, sendTransaction: sendNativeTransfer } =
    useSendTransaction();
  useTxHashToast(sendNativeTransferHash);

  const handleMaxClick = () => {
    if (
      currentChainVariant &&
      currentChainVariant.address === "native" &&
      nativeBalance
    ) {
      setAmountIn(formatUnits(nativeBalance.value, nativeBalance.decimals));
    } else if (
      currentChainVariant &&
      currentChainVariant.address !== "native" &&
      erc20Balance
    ) {
      setAmountIn(formatUnits(erc20Balance, currentChainVariant.decimals));
    }
  };

  const handleHalfClick = () => {
    if (
      currentChainVariant &&
      currentChainVariant.address === "native" &&
      nativeBalance
    ) {
      setAmountIn(
        formatUnits(nativeBalance.value / BigInt(2), nativeBalance.decimals),
      );
    } else if (
      currentChainVariant &&
      currentChainVariant.address !== "native" &&
      erc20Balance
    ) {
      setAmountIn(
        formatUnits(erc20Balance / BigInt(2), currentChainVariant.decimals),
      );
    }
  };

  const handleDeposit = async () => {
    if (
      amountIn &&
      selectedSymbol &&
      currentChainVariant &&
      depositAddress &&
      isAddress(depositAddress) &&
      isAddress(address)
    ) {
      if (currentChainVariant.address === "native") {
        sendNativeTransfer({
          to: depositAddress,
          value: parseEther(amountIn),
        });
      } else {
        sendErc20Transfer({
          address: address,
          args: [
            depositAddress,
            parseUnits(amountIn, currentChainVariant.decimals),
          ],
        });
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
              Balance:{" "}
              {currentChainVariant?.address === "native" && nativeBalance
                ? formatUnits(nativeBalance.value, nativeBalance.decimals)
                : erc20Balance?.toString()}
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

        <DepositAddressPanel address={depositAddress || ""} />

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
