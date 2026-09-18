import { assetUrl } from "../../services/paths.js";
import { CONFIG } from "../../config/installation.js";
const Icon = ({ name, ...props }) => <img src={assetUrl(name + ".svg")} alt="" {...props} />;
export function InstallationControls({ snapshot, invoke }) {
  return (
    <>
      <nav
        id="view-controls"
        aria-label="Timeline view controls"
        style={{
          "--control-offset": snapshot.informationPanelVisible ? "0px" : "calc(455 * var(--sx))",
        }}
        data-waiting={String(!snapshot.active && !snapshot.pulsePreview)}
        data-phase={snapshot.phase}
        data-helper-visible={String(snapshot.navigationHelperVisible)}
        onMouseEnter={() => invoke("setNavigationHelperHovered", true)}
        onMouseLeave={() => invoke("setNavigationHelperHovered", false)}
        onPointerDownCapture={() => invoke("interactNavigationHelper")}
        onPointerMoveCapture={() => invoke("interactNavigationHelper")}
        onClickCapture={() => invoke("interactNavigationHelper")}
        onWheelCapture={() => invoke("interactNavigationHelper")}
        onKeyDownCapture={() => invoke("interactNavigationHelper")}
      >
        <div
          id="navigation-helper"
          data-visible={String(snapshot.navigationHelperVisible)}
          aria-hidden={!snapshot.navigationHelperVisible}
          inert={!snapshot.navigationHelperVisible}
        >
          <button
            id="view-zoom-in"
            className="zoom-button"
            type="button"
            aria-label="Zoom in"
            onClick={() => invoke("zoomIn")}
          >
            <Icon name="zoom-plus-horizontal" className="plus-vertical" width="16" height="2" />
            <Icon name="zoom-plus-horizontal" className="plus-horizontal" width="16" height="2" />
          </button>
          <button
            id="view-zoom-out"
            className="zoom-button"
            type="button"
            aria-label="Zoom out"
            onClick={() => invoke("zoomOut")}
          >
            <Icon name="zoom-minus" className="minus-horizontal" width="17" height="2" />
          </button>
          <button
            id="view-live"
            className="mode-button"
            type="button"
            aria-pressed={snapshot.followLive}
            onClick={() => invoke("live")}
          >
            <Icon name="live" width="20" height="20" />
            <span>LIVE</span>
          </button>
          <button
            id="view-fit"
            className="mode-button"
            type="button"
            aria-label="Fit all elapsed time"
            aria-pressed={snapshot.fitAll}
            onClick={() => invoke("fit")}
          >
            <Icon name="fit" width="20" height="20" />
            <span>FIT</span>
          </button>
          <p className="scroll-hint">
            <Icon name="scroll" width="24" height="24" />
            <span>
              <strong>SCROLL</strong> to zoom in/out
            </span>
          </p>
        </div>
        <button
          id="panel-toggle"
          type="button"
          aria-label={
            snapshot.navigationHelperVisible ? "Hide navigation helper" : "Show navigation helper"
          }
          aria-controls="navigation-helper"
          aria-expanded={snapshot.navigationHelperVisible}
          onClick={() => invoke("toggleNavigationHelper")}
        >
          <Icon name="panel-toggle" width="21" height="33" />
          <Icon name="waiting-panel-toggle" className="waiting-toggle" width="21" height="33" />
          <Icon name="waiting-panel-toggle" className="daily-toggle" width="21" height="33" />
        </button>
      </nav>
      <nav
        id="overview-days"
        aria-label="Select a day's graph and schedule from the weekly overview"
        hidden={!snapshot.informationPanelVisible || snapshot.before}
      >
        {Array.from(
          {
            length: CONFIG.CAMPAIGN_DAYS,
          },
          (_, day) => (
            <button
              key={day}
              id={"overview-day-" + day}
              type="button"
              aria-label={snapshot.dayLabels?.[day] || "View D" + (day + 1) + " graph and schedule"}
              title={snapshot.dayLabels?.[day]}
              aria-pressed={snapshot.selectedOverviewDay === day}
              onClick={() => invoke("selectDay", day)}
            />
          ),
        )}
      </nav>
    </>
  );
}
