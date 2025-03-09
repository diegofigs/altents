import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  arbitrum,
  aurora,
  base,
  mainnet,
  polygon,
  berachain,
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
    {
      ...aurora,
      iconUrl:
        "https://raw.githubusercontent.com/trisolaris-labs/tokens/master/assets/chains/aurora.png",
    },
  ],
  ssr: false,
});
