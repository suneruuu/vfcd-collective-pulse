import { ScheduleAgenda } from "../../src/schedule/components/ScheduleAgenda.jsx";
import { ScheduleCard } from "../../src/schedule/components/ScheduleCard.jsx";
import { renderToStaticMarkup } from "react-dom/server";
import { InstallationShell, INITIAL_SNAPSHOT } from "../../src/installation/InstallationPage.jsx";
import { SchedulePanel } from "../../src/schedule/SchedulePanel.jsx";
import { PromptManagerShell } from "../../src/prompts/PromptManagerPage.jsx";
export const installationMarkup = (snapshot) =>
  renderToStaticMarkup(<InstallationShell snapshot={{ ...INITIAL_SNAPSHOT, ...snapshot }} />);
export const scheduleMarkup = (now, visible = true, selectedDayIndex = null) =>
  renderToStaticMarkup(
    <SchedulePanel now={now} visible={visible} selectedDayIndex={selectedDayIndex} />,
  );
export const timelineMarkup = (timeline) =>
  renderToStaticMarkup(<ScheduleAgenda timeline={timeline} />);
export const scheduleCardMarkup = (event) => renderToStaticMarkup(<ScheduleCard event={event} />);
export const managerMarkup = (state) => renderToStaticMarkup(<PromptManagerShell state={state} />);
