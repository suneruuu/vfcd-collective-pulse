export function TimedScreen({ snapshot, invoke }) {
  const screen = snapshot.timedScreen;
  return (
    <section
      id="campaign-screen"
      aria-label="Collective Pulse opening and closing screen"
      hidden={screen?.hidden ?? true}
      data-phase={screen?.phase}
      data-preview={String(snapshot.pulsePreview)}
      style={{
        "--main-width": (screen?.mainWidth || snapshot.mainWidth || 1465) + "px",
      }}
    >
      <div className="campaign-screen-copy">
        <p id="campaign-screen-label">{screen?.label}</p>
        <p id="campaign-screen-value">{screen?.value}</p>
      </div>
      <button
        id="view-pulse"
        type="button"
        hidden={screen?.buttonHidden ?? true}
        aria-pressed={snapshot.pulsePreview}
        aria-label={snapshot.pulsePreview ? "Return to timed screen" : "View recorded pulse"}
        onClick={() => invoke("togglePreview")}
      >
        <img src="/assets/view-pulse.svg" width="24" height="24" alt="" />
        <span id="view-pulse-label">{snapshot.pulsePreview ? "Hide pulse" : "View pulse"}</span>
      </button>
    </section>
  );
}
