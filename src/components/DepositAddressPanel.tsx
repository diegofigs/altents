import React, { useState } from "react";
import { FiCopy } from "react-icons/fi";

interface DepositAddressPanelProps {
  address: string;
}

const DepositAddressPanel: React.FC<DepositAddressPanelProps> = ({
  address,
}) => {
  const [copied, setCopied] = useState(false);

  // Truncate the address for display (e.g., 0xB1D9...faCc)
  const truncateAddress = (addr: string) => {
    if (addr.length <= 10) return addr;
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  };

  return (
    <div className="flex items-center justify-center bg-gray-800 rounded-md px-3 py-2 text-white shadow-sm">
      {/* Truncated address */}
      <span className="font-mono text-sm">{truncateAddress(address)}</span>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="ml-2 flex items-center justify-center rounded-md bg-amber-400 p-2 text-white"
      >
        <FiCopy size={16} />
      </button>

      {/* Copied message */}
      {copied && (
        <span className="ml-2 text-xs text-gray-400 transition-opacity">
          Copied!
        </span>
      )}
    </div>
  );
};

export default DepositAddressPanel;
