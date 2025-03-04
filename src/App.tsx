import {
  Label,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import {
  ConnectButton,
  darkTheme,
  getDefaultConfig,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FaArrowDown, FaGithub } from "react-icons/fa";
import { MdOutlineSwapVert } from "react-icons/md";
import { toast, ToastContainer } from "react-toastify";
import { useAccount, WagmiProvider } from "wagmi";
import { arbitrum, aurora, base, mainnet, polygon } from "wagmi/chains";
import {
  fetchQuote,
  fetchTokens,
  getDepositedBalances,
  publishIntent,
  Token,
} from "./core";
import { getUnifiedTokenList, UnifiedAsset } from "./core/tokens";
import { formatFixedPoint, limitDecimals } from "./core/utils";

type AggregatedAsset = Token & UnifiedAsset;

// New SplashScreen component
function SplashScreen() {
  return (
    <div className="min-h-screen min-w-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600">
      <div className="flex items-center justify-center mb-4">
        <svg
          className="animate-spin h-12 w-12 text-gray-100"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          ></path>
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-100 mb-2">Loading Assets</h2>
      <p className="text-gray-100">
        Please wait while we prepare your experience...
      </p>
    </div>
  );
}

// Custom TokenSelect component using Headless UI Listbox
function TokenSelect({
  options,
  selected,
  onChange,
  label,
}: {
  options: AggregatedAsset[];
  selected: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const selectedAsset = options.find(
    (asset) => asset.defuse_asset_id === selected,
  );
  return (
    <Listbox value={selected} onChange={onChange}>
      {label && (
        <Label className="block text-sm font-medium text-gray-400">
          {label}
        </Label>
      )}
      <div className="relative mt-1 w-full">
        <ListboxButton className="relative w-full cursor-default rounded-md bg-gray-700 py-2 pl-3 pr-10 text-left shadow-md focus:outline-none focus:bg-gray-600 text-2xl">
          <span className="flex items-center">
            {selectedAsset?.icon && (
              <img
                src={selectedAsset.icon}
                alt=""
                className="h-5 w-5 flex-shrink-0 rounded-full"
              />
            )}
            <span className="ml-3 block truncate">
              {selectedAsset
                ? `${selectedAsset.blockchain}:${selectedAsset.symbol}`
                : "Select token"}
            </span>
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <FaArrowDown className="h-5 w-5 text-gray-300" aria-hidden="true" />
          </span>
        </ListboxButton>
        <ListboxOptions className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          {options.map((asset) => (
            <ListboxOption
              key={asset.defuse_asset_id}
              value={asset.defuse_asset_id}
              className={({ selected }) =>
                `relative cursor-default select-none py-2 pl-10 pr-4 ${
                  selected ? "bg-blue-600 text-white" : "text-gray-200"
                }`
              }
            >
              {({ selected: isSelected }) => (
                <span
                  className={`flex items-center ${isSelected ? "font-medium" : "font-normal"}`}
                >
                  {asset.icon && (
                    <img
                      src={asset.icon}
                      alt=""
                      className="h-5 w-5 flex-shrink-0 rounded-full"
                    />
                  )}
                  <span className="ml-3 block truncate">
                    {asset.blockchain}:{asset.symbol}
                  </span>
                </span>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}

const config = getDefaultConfig({
  appName: "altents.com",
  projectId: import.meta.env.VITE_WALLET_PROJECT_ID,
  chains: [
    mainnet,
    polygon,
    arbitrum,
    base,
    {
      ...aurora,
      iconUrl:
        "https://raw.githubusercontent.com/trisolaris-labs/tokens/master/assets/chains/aurora.png",
    },
  ],
  ssr: false,
});

const queryClient = new QueryClient();
const tokenList = getUnifiedTokenList().reduce<Record<string, UnifiedAsset>>(
  (acc, asset) => ({
    ...acc,
    [asset.defuse_asset_id]: asset,
  }),
  {},
);

export default function App() {
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
  const orderedAssets = useMemo(
    () =>
      [...assets]
        .sort((a, b) =>
          a.blockchain < b.blockchain
            ? -1
            : a.blockchain > b.blockchain
              ? 1
              : 0,
        )
        .map<AggregatedAsset>((asset) => ({
          ...asset,
          ...tokenList[asset.defuse_asset_id],
        })),
    [assets],
  );

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
    "nep141:eth-0xa35923162c49cf95e6bf26623385eb431ad920d3.omft.near",
  );

  const assetIn = useMemo(
    () => orderedAssets.find((asset) => asset.defuse_asset_id === inputTokenId),
    [orderedAssets, inputTokenId],
  );
  const assetOut = useMemo(
    () =>
      orderedAssets.find((asset) => asset.defuse_asset_id === outputTokenId),
    [orderedAssets, outputTokenId],
  );

  // ------------------------
  // Swap Tokens Handler
  // ------------------------
  const handleSwapTokens = () => {
    const temp = inputTokenId;
    setInputTokenId(outputTokenId);
    setOutputTokenId(temp);
  };

  // ------------------------
  // Fetch quotes
  // ------------------------
  const { data: quote, isLoading: isLoadingQuote } = useQuery({
    queryKey: ["quote", amountIn, inputTokenId, outputTokenId],
    queryFn: async () =>
      fetchQuote({
        inputTokenId,
        outputTokenId,
        exactAmountIn: BigInt(
          parseFloat(amountIn) * 10 ** (assetIn?.decimals || 1),
        ).toString(),
      }),
    enabled: !!assetIn && parseFloat(amountIn) > 0,
  });

  const balanceAssetIn = useMemo(() => {
    if (balances && assetIn) {
      const scale = BigInt(10 ** assetIn.decimals);
      const scaledResult =
        (balances[assetIn.defuse_asset_id] * scale) /
        BigInt(10 ** assetIn.decimals);
      return limitDecimals(formatFixedPoint(scaledResult, assetIn.decimals), 2);
    }
  }, [assetIn, balances]);

  const balanceAssetOut = useMemo(() => {
    if (balances && assetOut) {
      const scale = BigInt(10 ** assetOut.decimals);
      const scaledResult =
        (balances[assetOut.defuse_asset_id] * scale) /
        BigInt(10 ** assetOut.decimals);
      return limitDecimals(
        formatFixedPoint(scaledResult, assetOut.decimals),
        2,
      );
    }
  }, [assetOut, balances]);

  // ------------------------
  // Early returns for load/error
  // ------------------------
  if (isFetchingAssets) {
    return <SplashScreen />;
  }

  if (errorAssets) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-800">
        <p className="text-red-400 font-semibold text-lg">
          Error: {errorAssets.message}
        </p>
      </div>
    );
  }

  // ------------------------
  // Main Render
  // ------------------------
  return (
    <div className="bg-gray-800 text-gray-100 min-h-screen min-w-screen flex flex-col">
      {/* Header */}
      <header className="py-4 px-6 w-full flex justify-between items-center border-b border-gray-700">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="text-blue-500">alt</span>ents
        </h1>
        <ConnectButton />
      </header>

      {/* Swap Card */}
      <main className="flex-grow flex items-center justify-center px-4 py-8">
        <div
          className="w-full max-w-lg bg-gray-700 rounded-2xl shadow-lg p-8 space-y-6"
          role="form"
          aria-label="Swap Form"
        >
          {/* From Section: Amount In + Token Select */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div className="flex flex-col">
              <label
                htmlFor="amountIn"
                className="block text-sm font-medium text-gray-400"
              >
                Amount In
              </label>
              <div className="flex items-baseline">
                <input
                  id="amountIn"
                  type="number"
                  inputMode="decimal"
                  placeholder="Enter amount"
                  aria-label="Input amount"
                  className="mt-1 w-full text-2xl font-semibold text-gray-100 bg-transparent border-b border-gray-600 pb-2 focus:outline-none focus:border-blue-500 transition-colors"
                  value={amountIn}
                  onChange={(e) => setAmountIn(e.target.value)}
                />
              </div>
              <p className="mt-1 text-sm text-gray-400 truncate">
                ~$
                {amountIn && assetIn
                  ? Number(
                      (parseFloat(amountIn) * assetIn.price).toPrecision(6),
                    )
                  : "0.0"}
              </p>
            </div>
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-400">
                Token
              </label>
              <div className="flex items-baseline w-full">
                <TokenSelect
                  options={orderedAssets}
                  selected={inputTokenId}
                  onChange={setInputTokenId}
                />
              </div>
              <p className="mt-1 text-sm text-gray-400">
                Balance: {balanceAssetIn || "0"}
              </p>
            </div>
          </div>

          {/* Swap Button (swaps input/output tokens) */}
          <div className="flex items-center justify-center mt-4">
            <button
              onClick={handleSwapTokens}
              className="w-10 h-10 relative rounded-full bg-gray-600 flex items-center justify-center hover:bg-gray-500 focus:outline-none"
              aria-label="Swap input and output tokens"
            >
              <MdOutlineSwapVert className="absolute h-6 w-6 text-gray-300 transform" />
            </button>
          </div>

          {/* To Section: Amount Out + Token Select */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-4">
            <div className="flex flex-col">
              <label
                htmlFor="amountOut"
                className="block text-sm font-medium text-gray-400"
              >
                Amount Out
              </label>
              <div className="flex items-baseline">
                <div
                  id="amountOut"
                  className="mt-1 w-full text-2xl font-semibold text-gray-100 bg-transparent border-b border-gray-600 pb-2 truncate"
                >
                  {quote?.amount_out && assetOut?.decimals
                    ? parseInt(quote.amount_out) / 10 ** assetOut.decimals
                    : "0.0"}
                </div>
              </div>
              <p className="mt-1 text-sm text-gray-400 truncate">
                ~$
                {quote?.amount_out && assetOut
                  ? Number(
                      (parseInt(quote.amount_out) / 10 ** assetOut.decimals) *
                        assetOut.price,
                    ).toPrecision(6)
                  : "0.0"}
              </p>
            </div>
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-400">
                Token
              </label>
              <div className="flex items-baseline w-full">
                <TokenSelect
                  options={orderedAssets}
                  selected={outputTokenId}
                  onChange={setOutputTokenId}
                />
              </div>
              <p className="mt-1 text-sm text-gray-400">
                Balance: {balanceAssetOut || "0"}
              </p>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={async () => {
              await publishIntent({
                config,
                address,
                quote,
                inputTokenId,
                outputTokenId,
              });
              toast("Publish Intent successful");
            }}
            disabled={!address}
            className="w-full py-3 mt-6 rounded-full text-lg font-semibold text-gray-100 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-colors disabled:opacity-50"
          >
            Swap
          </button>

          {/* Quote status */}
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

      {/* Footer */}
      <footer className="py-4 px-6 w-full flex justify-center items-center border-t border-gray-700">
        <p className="text-sm text-gray-400 flex items-center space-x-2">
          <span>made with ♥️ in 🇵🇷</span>
          <a
            href="https://github.com/diegofigs/altents"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center hover:text-gray-200 transition-colors"
          >
            <FaGithub size={16} />
          </a>
        </p>
      </footer>
      <ToastContainer />
    </div>
  );
}

export const WrappedApp = () => (
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider theme={darkTheme()}>
        <App />
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);
