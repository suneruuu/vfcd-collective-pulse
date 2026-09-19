import { useEffect } from "react";
import InstallationPage from "./installation/InstallationPage.jsx";
import PromptManagerPage from "./prompts/PromptManagerPage.jsx";
import VotePage from "./vote/VotePage.jsx";
import VoteAuthGate from "./vote/VoteAuthGate.jsx";
import AdminGate from "./prompts/AdminGate.jsx";
import { appPath } from "./services/paths.js";
export default function App() {
  const path = appPath(window.location.pathname, (import.meta.env || {}).BASE_URL || "/");
  const manager = ["/prompts", "/prompts.html", "/prompts/index.html"].includes(path);
  const vote = ["/vote", "/vote.html", "/vote/index.html"].includes(path);
  useEffect(() => {
    document.title = manager
      ? "Question Queue \u2014 Collective Pulse"
      : vote
        ? "Vote \u2014 Collective Pulse"
        : "Collective Pulse \u2014 Vietnam Creative Festival";
  }, [manager, vote]);
  return manager ? (
    <AdminGate>
      <PromptManagerPage />
    </AdminGate>
  ) : vote ? (
    <VoteAuthGate>
      <VotePage />
    </VoteAuthGate>
  ) : (
    <InstallationPage />
  );
}
