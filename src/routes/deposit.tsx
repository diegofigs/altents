import { createFileRoute } from "@tanstack/react-router";
import { Deposit } from "../pages/Deposit";

export const Route = createFileRoute("/deposit")({
  component: Deposit,
});
