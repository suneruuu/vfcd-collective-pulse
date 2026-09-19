import { useRef } from "react";
import { useInstallation } from "./hooks/useInstallation.js";
import { InstallationControls } from "./components/InstallationControls.jsx";
import { InstallationCredits } from "./components/InstallationCredits.jsx";
import { TimedScreen } from "./components/TimedScreen.jsx";
import { SchedulePanel } from "../schedule/SchedulePanel.jsx";
export const INITIAL_SNAPSHOT = {
  now: Date.now(),
  informationPanelVisible: true,
  navigationHelperVisible: true,
  before: false,
  active: false,
  phase: "before-event",
  followLive: true,
  fitAll: false,
  selectedOverviewDay: null,
  pulsePreview: false,
};
export function InstallationShell({ snapshot = INITIAL_SNAPSHOT, invoke = () => {}, host }) {
  return (
    <>
      <main id="app" ref={host} aria-label="Collective Pulse voting installation" />
      <TimedScreen snapshot={snapshot} invoke={invoke} />
      <SchedulePanel
        now={snapshot.now}
        visible={snapshot.informationPanelVisible}
        phase={snapshot.phase}
        selectedDayIndex={snapshot.selectedOverviewDay}
      />
      <InstallationCredits />
      <InstallationControls snapshot={snapshot} invoke={invoke} />
      {snapshot.cloudStatus && (
        <p className="cloud-status" role="status">
          {snapshot.cloudStatus}
        </p>
      )}
      <p id="vote-status" className="sr-only" aria-live="polite">
        {snapshot.status}
      </p>
      {snapshot.error && (
        <p role="alert" className="startup-error">
          {snapshot.error}
        </p>
      )}
    </>
  );
}
export default function InstallationPage() {
  const host = useRef(null);
  const { snapshot, invoke } = useInstallation(host);
  return <InstallationShell host={host} snapshot={snapshot || INITIAL_SNAPSHOT} invoke={invoke} />;
}
