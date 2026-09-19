const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const load = require("./helpers/load-module.cjs");

const { YES, NO } = load("src/config/installation.js");
const { createInstallationAudio } = load("src/installation/domain/audio.js");
const { createCanvasInput } = load("src/installation/rendering/canvasInput.js");
const { soundUrl } = load("src/services/paths.js");

const tracks = [];
const documentRef = {
  createElement(type) {
    assert.equal(type, "audio");
    const track = {
      currentTime: 9,
      paused: true,
      playCount: 0,
      pauseCount: 0,
      play() {
        this.playCount++;
        this.paused = false;
        return Promise.resolve();
      },
      pause() {
        this.pauseCount++;
        this.paused = true;
      },
    };
    tracks.push(track);
    return track;
  },
};

const audio = createInstallationAudio({ documentRef });
assert.equal(tracks.length, 3, "ambient, YES, and NO must have independent audio tracks");
assert.equal(tracks[0].src, "/sounds/VFCD_Background Music.wav");
assert.equal(tracks[1].src, "/sounds/VFCD_Yes.wav");
assert.equal(tracks[2].src, "/sounds/VFCD_No.wav");
assert.equal(tracks[0].loop, true, "ambient music must loop");
assert.equal(tracks[0].preload, "auto");
assert.equal(tracks[0].volume, 0.4);

audio.startAmbient();
audio.startAmbient();
assert.equal(tracks[0].playCount, 1, "an already playing ambient track must not restart");
audio.playChoice(YES);
assert.equal(tracks[1].playCount, 1, "a YES press must play the YES sound");
assert.equal(tracks[1].currentTime, 0, "repeated effects must restart immediately");
audio.playChoice(NO);
assert.equal(tracks[2].playCount, 1, "a NO press must play the NO sound");

const playedChoices = [];
const queuedChoices = [];
let acceptVote = true;
const p = { key: "", keyCode: 37 };
const input = createCanvasInput(
  { pulsePreview: false },
  {
    audio: {
      startAmbient() {},
      playChoice: (choice) => playedChoices.push(choice),
    },
    camera: {},
    campaign: { getCampaignTiming: () => ({ active: true }) },
    p,
    viewport: {},
    sampler: {
      queueDirection(choice) {
        queuedChoices.push(choice);
        return acceptVote;
      },
    },
    clock: { now: () => 0 },
  },
);
input.keyPressed({ repeat: false });
p.keyCode = 39;
input.keyPressed({ repeat: false });
assert.deepEqual(queuedChoices, [YES, NO], "left/right presses must queue YES/NO respectively");
assert.deepEqual(playedChoices, [YES, NO], "accepted presses must play feedback immediately");
acceptVote = false;
p.keyCode = 37;
input.keyPressed({ repeat: false });
input.keyPressed({ repeat: true });
assert.deepEqual(
  playedChoices,
  [YES, NO],
  "rejected votes and browser key repeats must not play feedback",
);

audio.stop();
assert(tracks.every((track) => track.pauseCount === 1 && track.currentTime === 0));
assert.equal(soundUrl("VFCD_Yes.wav"), "/sounds/VFCD_Yes.wav");

for (const filename of ["VFCD_Background Music.wav", "VFCD_Yes.wav", "VFCD_No.wav"]) {
  assert(fs.statSync(path.join(__dirname, "..", "public", "sounds", filename)).size > 0);
}

console.log(
  "Audio checks passed: looping ambience, immediate YES/NO routing, cleanup, and assets.",
);
