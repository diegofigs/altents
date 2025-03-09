import { defineConfig } from "@wagmi/cli";
import { react } from "@wagmi/cli/plugins";
import { erc20Abi } from "viem";

export default defineConfig({
  out: "src/generated.ts",
  contracts: [{ abi: erc20Abi, name: "erc20" }],
  plugins: [react()],
});
