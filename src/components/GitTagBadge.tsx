import React from "react";
import { FaTag } from "react-icons/fa";

const GitTagBadge: React.FC = () => {
  // Vite exposes env variables via import.meta.env; fallback to "dev" if not available
  const tag = import.meta.env.VITE_GIT_TAG || "dev";

  return (
    <div className="text-white rounded-md py-1 px-2 flex items-center text-sm">
      <FaTag style={{ marginRight: "5px" }} />
      <span>{tag}</span>
    </div>
  );
};

export default GitTagBadge;
