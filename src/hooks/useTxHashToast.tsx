// pollTxHashWagmi.ts
import { Id, toast } from "react-toastify";
import { useEffect, useRef } from "react";
import { useWaitForTransactionReceipt } from "wagmi";

/**
 * Example React hook that sets up a single toast and updates it
 * as the wagmi receipt status changes. This ends once the transaction is confirmed or fails.
 */
export function useTxHashToast(hash?: `0x${string}`) {
  const toastRef = useRef<Id>(undefined);

  // Using Wagmi’s built-in polling
  const { data, isError, isLoading, isSuccess } = useWaitForTransactionReceipt({
    hash,
    // watch: true => wagmi automatically polls every x seconds
    // confirmations: 1 => how many confirmations you want
  });

  useEffect(() => {
    if (!hash) return;
    // If we have no toast yet, create one
    if (toastRef.current === null) {
      toastRef.current = toast(`Broadcasting transaction…`, {
        autoClose: false,
        type: "info",
      });
    }
  }, [hash]);

  useEffect(() => {
    if (!toastRef.current) return;
    // If still loading => update toast
    if (isLoading) {
      toast.update(toastRef.current, {
        render: "Transaction still pending…",
        type: "info",
        autoClose: false,
      });
      return;
    }
    if (isError) {
      toast.update(toastRef.current, {
        render: "Transaction failed or not found.",
        type: "error",
        autoClose: 5000,
      });
      // reset so we don't overwrite it
      toastRef.current = undefined;
      return;
    }
    if (isSuccess) {
      // data should hold receipt => check .status
      if (data?.status === "reverted") {
        toast.update(toastRef.current, {
          render: "Transaction reverted!",
          type: "error",
          autoClose: 5000,
        });
      } else {
        toast.update(toastRef.current, {
          render: "🎉 Transaction confirmed!",
          type: "success",
          autoClose: 5000,
        });
      }
      toastRef.current = undefined;
    }
  }, [isLoading, isError, isSuccess, data]);

  // This hook doesn’t return anything; it’s purely for side effects
}
