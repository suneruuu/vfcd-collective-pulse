import { YES } from "../../config/installation.js";
import { soundUrl } from "../../services/paths.js";

const SOUND_FILES = Object.freeze({
  ambient: "VFCD_Background Music.wav",
  yes: "VFCD_Yes.wav",
  no: "VFCD_No.wav",
});

export function createInstallationAudio({ documentRef = globalThis.document } = {}) {
  const createTrack = (filename) => {
    const track = documentRef?.createElement?.("audio");
    if (!track) return null;
    track.src = soundUrl(filename);
    track.preload = "auto";
    return track;
  };
  const ambient = createTrack(SOUND_FILES.ambient);
  const effects = {
    yes: createTrack(SOUND_FILES.yes),
    no: createTrack(SOUND_FILES.no),
  };

  if (ambient) {
    ambient.loop = true;
    ambient.volume = 0.4;
  }

  const play = (track, restart = false) => {
    if (!track) return false;
    try {
      if (restart) track.currentTime = 0;
      const attempt = track.play?.();
      attempt?.catch?.(() => {});
      return true;
    } catch {
      return false;
    }
  };

  function startAmbient() {
    if (!ambient || !ambient.paused) return Boolean(ambient);
    return play(ambient);
  }

  function playChoice(choice) {
    // A physical vote is a user gesture, so it can also unlock ambient audio
    // after the browser has rejected the initial autoplay attempt.
    startAmbient();
    return play(choice === YES ? effects.yes : effects.no, true);
  }

  function stop() {
    for (const track of [ambient, effects.yes, effects.no]) {
      track?.pause?.();
      if (track) track.currentTime = 0;
    }
  }

  return { startAmbient, playChoice, stop };
}
