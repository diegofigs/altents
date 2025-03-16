import { createFileRoute } from "@tanstack/react-router";
import { SplashScreen } from "../components/SplashScreen";
import { fetchTokens } from "../core";
import { Swap } from "../pages/Swap";

export const Route = createFileRoute("/")({
  component: Swap,
  pendingComponent: SplashScreen,
  loader: async () => fetchTokens(),
  staleTime: 60_000,
});
