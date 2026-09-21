import { soundUrl } from "../services/paths.js";

export function createVoteAudio({
  documentRef = globalThis.document,
  onStatusChange = () => {},
  initialVolume = 0.4,
} = {}) {
  const track = documentRef?.createElement?.("audio");
  let elementVolumeWorks = false;
  if (track) {
    track.src = soundUrl("VFCD_Background Music.mp3");
    track.preload = "auto";
    track.loop = true;
    try {
      track.volume = initialVolume;
      elementVolumeWorks = Math.abs(track.volume - initialVolume) < 0.001;
    } catch {
      // Some mobile browsers keep volume under the device's physical control.
    }
  }

  let enabled = true;
  let status = "ready";
  let generation = 0;
  let volume = initialVolume;
  let statusListener = onStatusChange;
  let audioContext = null;
  let gainNode = null;

  function report(next) {
    status = next;
    statusListener(next);
  }

  function ensureGain() {
    if (elementVolumeWorks || gainNode) return true;
    const view = documentRef?.defaultView || globalThis.window;
    const AudioContext = view?.AudioContext || view?.webkitAudioContext;
    if (!AudioContext) return false;
    try {
      audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(track);
      gainNode = audioContext.createGain();
      gainNode.gain.value = volume;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      return true;
    } catch {
      audioContext?.close?.()?.catch?.(() => {});
      audioContext = null;
      gainNode = null;
      return false;
    }
  }

  function start() {
    if (!enabled || !track) return false;
    if (!ensureGain() && volume < 0.1) return false;
    const resumed = audioContext?.resume?.();
    if ((status === "playing" || status === "starting") && !track.paused) {
      const resumeId = generation;
      Promise.resolve(resumed).catch(() => {
        if (enabled && resumeId === generation) report("blocked");
      });
      return true;
    }
    const attemptId = ++generation;
    report("starting");
    try {
      Promise.all([Promise.resolve(track.play()), Promise.resolve(resumed)]).then(
        () => {
          if (enabled && attemptId === generation) report("playing");
        },
        () => {
          if (enabled && attemptId === generation) report("blocked");
        },
      );
      return true;
    } catch {
      if (enabled && attemptId === generation) report("blocked");
      return false;
    }
  }

  function setEnabled(next) {
    enabled = Boolean(next);
    if (enabled) start();
    else {
      generation++;
      track?.pause?.();
      report("off");
    }
  }

  function setVolume(next) {
    volume = next;
    if (gainNode) gainNode.gain.value = next;
    else if (elementVolumeWorks && track) track.volume = next;
  }

  function setStatusListener(listener) {
    statusListener = listener;
    listener(status);
  }

  function stop() {
    enabled = false;
    generation++;
    track?.pause?.();
    if (track) track.currentTime = 0;
    audioContext?.close?.()?.catch?.(() => {});
    audioContext = null;
    gainNode = null;
    status = "off";
  }

  return {
    start,
    setEnabled,
    isEnabled: () => enabled,
    getStatus: () => status,
    setVolume,
    setStatusListener,
    stop,
  };
}
