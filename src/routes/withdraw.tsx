import { createFileRoute } from "@tanstack/react-router";
import { SplashScreen } from "../components/SplashScreen";
import { getSupportedTokens } from "../core";
import { Withdraw } from "../pages/Withdraw";

const chains = ["eth:1", "eth:8453", "eth:42161", "eth:100", "eth:80094"];

export const Route = createFileRoute("/withdraw")({
  component: Withdraw,
  pendingComponent: SplashScreen,
  loader: async () => getSupportedTokens({ chains }),
  staleTime: 60_000,
});
