import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  arbitrum,
  aurora,
  base,
  berachain,
  gnosis,
  mainnet,
  polygon,
} from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "altents.com",
  projectId: import.meta.env.VITE_WALLET_PROJECT_ID,
  chains: [
    mainnet,
    polygon,
    arbitrum,
    base,
    berachain,
    gnosis,
    {
      ...aurora,
      iconUrl:
        "https://raw.githubusercontent.com/trisolaris-labs/tokens/master/assets/chains/aurora.png",
    },
  ],
  ssr: false,
});
