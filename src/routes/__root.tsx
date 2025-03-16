import { ConnectButton } from "@rainbow-me/rainbowkit";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { FaGithub } from "react-icons/fa";
import { ToastContainer } from "react-toastify";
import GitTagBadge from "../components/GitTagBadge";

export const Route = createRootRoute({
  component: () => {
    return (
      <>
        <div className="bg-gray-800 text-gray-100 min-h-screen min-w-screen flex flex-col justify-between">
          <header className="py-4 px-6 w-full flex justify-between items-center border-b border-gray-700">
            <Link to="/">
              <h1 className="text-4xl font-bold tracking-tight">
                <span className="text-blue-500">alt</span>ents
              </h1>
            </Link>
            <nav className="flex gap-4">
              <Link to="/deposit" className="[&.active]:font-bold">
                Deposit
              </Link>{" "}
              <Link to="/" className="[&.active]:font-bold">
                Swap
              </Link>{" "}
              <Link to="/withdraw" className="[&.active]:font-bold">
                Withdraw
              </Link>{" "}
            </nav>
            <ConnectButton
              accountStatus="address"
              chainStatus="none"
              showBalance={false}
            />
          </header>
          <Outlet />
          <footer
            className="py-4 px-6 w-full flex justify-end items-center gap-2
            border-t border-gray-700"
          >
            <p className="text-sm text-gray-400 flex items-center space-x-2">
              <a
                href="https://github.com/diegofigs/altents"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center hover:text-gray-200 transition-colors"
              >
                <FaGithub size={16} />
              </a>
            </p>
            <GitTagBadge />
          </footer>
        </div>
        <ToastContainer theme="dark" />
        {import.meta.env.DEV && <TanStackRouterDevtools />}
      </>
    );
  },
});
