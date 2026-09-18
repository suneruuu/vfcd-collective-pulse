import { CONFIG, YES, NO } from "../../config/installation.js";
export function createCanvasInput(
  runtime,
  { camera, campaign, p, viewport, sampler, clock = Date },
) {
  // -----------------------------------------------------------------------------
  // INPUT
  // -----------------------------------------------------------------------------

  function keyPressed(event) {
    if (event && event.repeat) return false;
    const timing = campaign.getCampaignTiming(clock.now());
    if (!timing.active && !runtime.pulsePreview && p.keyCode !== 37 && p.keyCode !== 39)
      return false;
    if (p.key === "f" || p.key === "F") {
      camera.activateFitAll();
      return false;
    }
    if (p.key === "l" || p.key === "L") {
      camera.activateLiveView();
      return false;
    }
    if (p.key === "+" || p.key === "=") {
      camera.zoomTimeline(CONFIG.ZOOM_FACTOR, viewport.getLayout(), camera.getGraphTiming(timing));
      return false;
    }
    if (p.key === "-" || p.key === "_") {
      camera.zoomTimeline(
        1 / CONFIG.ZOOM_FACTOR,
        viewport.getLayout(),
        camera.getGraphTiming(timing),
      );
      return false;
    }
    if (p.keyCode === 37) {
      sampler.queueDirection(YES);
      return false;
    }
    if (p.keyCode === 39) {
      sampler.queueDirection(NO);
      return false;
    }
    return true;
  }
  function keyReleased() {
    if (p.keyCode !== 37 && p.keyCode !== 39) return true;
    sampler.updateInputSampling();
    const direction = p.keyCode === 37 ? YES : NO;
    runtime.heldDirections.delete(direction);
    return false;
  }
  function mousePressed() {
    const campaignTiming = campaign.getCampaignTiming(clock.now());
    const layout = viewport.getLayout();
    const day = camera.overviewDayAtPoint(layout, p.mouseX, p.mouseY, campaignTiming);
    if (day !== null) {
      camera.selectOverviewDay(day);
      return false;
    }
    if (!campaignTiming.active && !runtime.pulsePreview) return true;
    const timing = camera.getGraphTiming(campaignTiming);
    const controls = viewport.viewControlRects(layout);
    if (viewport.pointInRect(p.mouseX, p.mouseY, controls.fitAll)) {
      camera.activateFitAll();
      return false;
    }
    if (viewport.pointInRect(p.mouseX, p.mouseY, controls.live)) {
      camera.activateLiveView();
      return false;
    }
    if (viewport.pointInRect(p.mouseX, p.mouseY, controls.zoomOut)) {
      camera.zoomTimeline(1 / CONFIG.ZOOM_FACTOR, layout, timing);
      return false;
    }
    if (viewport.pointInRect(p.mouseX, p.mouseY, controls.zoomIn)) {
      camera.zoomTimeline(CONFIG.ZOOM_FACTOR, layout, timing);
      return false;
    }
    if (viewport.pointInRect(p.mouseX, p.mouseY, layout.graph)) {
      runtime.fitAll = false;
      runtime.followLive = false;
      runtime.dragState = {
        startMouseX: p.mouseX,
        startViewSecond: runtime.viewStartSecond,
      };
      return false;
    }
    return true;
  }
  function mouseDragged() {
    if (!runtime.dragState) return true;
    const deltaSeconds = (runtime.dragState.startMouseX - p.mouseX) / runtime.zoomSecondWidth;
    runtime.viewStartSecond = camera.constrainViewStart(
      runtime.dragState.startViewSecond + deltaSeconds,
      camera.getGraphTiming(campaign.getCampaignTiming(clock.now())),
    );
    return false;
  }
  function mouseReleased() {
    runtime.dragState = null;
  }
  function doubleClicked() {
    if (!campaign.getCampaignTiming(clock.now()).active && !runtime.pulsePreview) return true;
    if (viewport.pointInRect(p.mouseX, p.mouseY, viewport.getLayout().graph)) {
      camera.activateLiveView();
      return false;
    }
    return true;
  }
  function mouseWheel(event) {
    const layout = viewport.getLayout();
    if (!viewport.pointInRect(p.mouseX, p.mouseY, layout.graph)) return true;
    const campaignTiming = campaign.getCampaignTiming(clock.now());
    if (!campaignTiming.active && !runtime.pulsePreview) return true;
    const timing = camera.getGraphTiming(campaignTiming);
    if (!event.shiftKey) {
      const factor = event.deltaY < 0 ? CONFIG.ZOOM_FACTOR : 1 / CONFIG.ZOOM_FACTOR;
      camera.zoomTimeline(factor, layout, timing, p.mouseX);
      return false;
    }
    runtime.fitAll = false;
    runtime.followLive = false;
    const wheelDelta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const currentWidth = viewport.secondWidthForView(layout.graph, timing);
    runtime.viewStartSecond = camera.constrainViewStart(
      runtime.viewStartSecond + wheelDelta * 0.12 * (CONFIG.SECOND_WIDTH / currentWidth),
      timing,
    );
    return false;
  }
  return {
    keyPressed,
    keyReleased,
    mousePressed,
    mouseDragged,
    mouseReleased,
    doubleClicked,
    mouseWheel,
  };
}
