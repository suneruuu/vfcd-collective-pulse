import { useEffect } from "react";
import InstallationPage from "./installation/InstallationPage.jsx";
import PromptManagerPage from "./prompts/PromptManagerPage.jsx";
export default function App() {
  const manager = ["/prompts", "/prompts/", "/prompts.html"].includes(window.location.pathname);
  useEffect(() => {
    document.title = manager
      ? "Question Queue \u2014 Collective Pulse"
      : "Collective Pulse \u2014 Vietnam Creative Festival";
  }, [manager]);
  return manager ? <PromptManagerPage /> : <InstallationPage />;
}
