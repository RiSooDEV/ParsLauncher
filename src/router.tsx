import { createMemoryRouter } from "react-router";
import Backpack from "@/pages/backpack.tsx";
import Library from "@/pages/library";
import Modpacks from "@/pages/modpacks.tsx";
import Settings from "@/pages/settings.tsx";
import { RouteErrorBoundary } from "./components/pars/error-boundary";
import Layout from "./layout";
import IndexPage from "./pages";
import AssistantPage from "./pages/assistant";
import Console from "./pages/console.tsx";
import Servers from "./pages/servers";
import Downloads from "./pages/downloads";
import SkinPage from "./pages/skin";
import Achievements from "./pages/pars/achievements";
import Badges from "./pages/pars/badges";
import Journey from "./pages/pars/journey";
import ParsProfile from "./pages/pars/profile";
import InstanceManager from "./pages/instance-manager";

export const router = createMemoryRouter([
  {
    children: [
      { element: <IndexPage />, path: "/" },
      { element: <Servers />, path: "/servers" },
      { element: <SkinPage />, path: "/skin" },
      { element: <Library />, path: "/library" },
      { element: <ParsProfile />, path: "/profile" },
      { element: <AssistantPage />, path: "/assistant" },
      { element: <Settings />, path: "/settings" },
      { element: <Downloads />, path: "/downloads" },
      { element: <InstanceManager />, path: "/instances" },
      { element: <Backpack />, path: "/backpack" },
      { element: <Modpacks />, path: "/modpacks" },
      { element: <Console />, path: "/console" },
      { element: <Achievements />, path: "/achievements" },
      { element: <Badges />, path: "/badges" },
      { element: <Journey />, path: "/journey" },
    ],
    element: <Layout />,
    errorElement: <RouteErrorBoundary />,
  },
]);
