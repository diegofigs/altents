import { createFileRoute } from "@tanstack/react-router";
import { Swap } from "../pages/Swap";

export const Route = createFileRoute("/")({
  component: Swap,
});
