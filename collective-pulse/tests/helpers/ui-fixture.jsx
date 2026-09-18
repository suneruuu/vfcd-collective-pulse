import { ScheduleAgenda } from "../../src/schedule/components/ScheduleAgenda.jsx";
import { ScheduleCard } from "../../src/schedule/components/ScheduleCard.jsx";
import { renderToStaticMarkup } from "react-dom/server";
import { InstallationShell, INITIAL_SNAPSHOT } from "../../src/installation/InstallationPage.jsx";
import { SchedulePanel } from "../../src/schedule/SchedulePanel.jsx";
import { PromptManagerShell } from "../../src/prompts/PromptManagerPage.jsx";
export const installationMarkup = (snapshot) =>
  renderToStaticMarkup(<InstallationShell snapshot={{ ...INITIAL_SNAPSHOT, ...snapshot }} />);
export const scheduleMarkup = (now, visible = true) =>
  renderToStaticMarkup(<SchedulePanel now={now} visible={visible} />);
export const agendaMarkup = (agenda) => renderToStaticMarkup(<ScheduleAgenda agenda={agenda} />);
export const scheduleCardMarkup = (event) => renderToStaticMarkup(<ScheduleCard event={event} />);
export const managerMarkup = (state) => renderToStaticMarkup(<PromptManagerShell state={state} />);
