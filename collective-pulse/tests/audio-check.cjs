const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const load = require("./helpers/load-module.cjs");

const { YES, NO } = load("src/config/installation.js");
const { createInstallationAudio } = load("src/installation/domain/audio.js");
const { createVoteAudio } = load("src/vote/audio.js");
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

async function voteAudioChecks() {
  const voteTracks = [];
  const statuses = [];
  let allowPlayback = false;
  const voteAudio = createVoteAudio({
    documentRef: {
      createElement(type) {
        assert.equal(type, "audio");
        const track = {
          currentTime: 7,
          paused: true,
          playCount: 0,
          pauseCount: 0,
          play() {
            this.playCount++;
            if (!allowPlayback)
              return Promise.reject(new DOMException("Blocked", "NotAllowedError"));
            this.paused = false;
            return Promise.resolve();
          },
          pause() {
            this.pauseCount++;
            this.paused = true;
          },
        };
        voteTracks.push(track);
        return track;
      },
    },
    onStatusChange: (status) => statuses.push(status),
    initialVolume: 0.001,
  });
  assert.equal(voteTracks.length, 1, "The vote page loads only the ambient track");
  assert.equal(voteTracks[0].src, "/sounds/VFCD_Background Music.mp3");
  assert.equal(voteTracks[0].loop, true);
  assert.equal(voteTracks[0].volume, 0.001);
  voteAudio.setVolume(0.4);
  assert.equal(voteTracks[0].volume, 0.4);
  voteAudio.start();
  await new Promise(setImmediate);
  assert.equal(voteAudio.getStatus(), "blocked", "Autoplay rejection must be visible");
  allowPlayback = true;
  voteAudio.start();
  await new Promise(setImmediate);
  assert.equal(voteAudio.getStatus(), "playing", "A later tap can start blocked audio");
  assert.equal(voteTracks[0].playCount, 2);
  voteAudio.start();
  assert.equal(voteTracks[0].playCount, 2, "Playing audio must not restart");
  voteAudio.setEnabled(false);
  assert.equal(voteAudio.isEnabled(), false);
  assert.equal(voteAudio.getStatus(), "off");
  assert.equal(voteTracks[0].pauseCount, 1);
  voteAudio.start();
  assert.equal(voteTracks[0].playCount, 2, "Muted audio stays paused during vote interactions");
  voteAudio.setEnabled(true);
  await new Promise(setImmediate);
  assert.equal(voteTracks[0].playCount, 3, "Unmuting resumes playback");
  assert.equal(voteAudio.getStatus(), "playing");
  voteAudio.stop();
  assert.equal(voteTracks[0].currentTime, 0);
  assert.equal(voteTracks[0].pauseCount, 2);
  assert.deepEqual(statuses, [
    "starting",
    "blocked",
    "starting",
    "playing",
    "off",
    "starting",
    "playing",
  ]);

  let gain;
  let contextClosed = false;
  const mobileTrack = {
    paused: true,
    currentTime: 3,
    get volume() {
      return 1;
    },
    set volume(_) {},
    play() {
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
  };
  const mobileAudio = createVoteAudio({
    documentRef: {
      createElement: () => mobileTrack,
      defaultView: {
        AudioContext: class {
          destination = {};
          createMediaElementSource() {
            return { connect() {} };
          }
          createGain() {
            gain = { gain: { value: 1 }, connect() {} };
            return gain;
          }
          resume() {
            return Promise.resolve();
          }
          close() {
            contextClosed = true;
            return Promise.resolve();
          }
        },
      },
    },
    initialVolume: 0.001,
  });
  mobileAudio.start();
  await new Promise(setImmediate);
  await new Promise(setImmediate);
  assert.equal(mobileAudio.getStatus(), "playing");
  assert.equal(gain.gain.value, 0.001, "Mobile login audio must stay quiet");
  mobileAudio.setVolume(0.4);
  assert.equal(gain.gain.value, 0.4, "The same track reaches normal volume after login");
  mobileAudio.stop();
  assert(contextClosed);
}
assert.equal(soundUrl("VFCD_Yes.wav"), "/sounds/VFCD_Yes.wav");

for (const filename of [
  "VFCD_Background Music.wav",
  "VFCD_Background Music.mp3",
  "VFCD_Yes.wav",
  "VFCD_No.wav",
]) {
  assert(fs.statSync(path.join(__dirname, "..", "public", "sounds", filename)).size > 0);
}

const originalAmbientBytes = fs.statSync(
  path.join(__dirname, "..", "public", "sounds", "VFCD_Background Music.wav"),
).size;
const voteAmbientBytes = fs.statSync(
  path.join(__dirname, "..", "public", "sounds", "VFCD_Background Music.mp3"),
).size;
assert(voteAmbientBytes < originalAmbientBytes / 10, "Vote music must load promptly");

voteAudioChecks()
  .then(() =>
    console.log(
      "Audio checks passed: looping ambience, browser-blocked playback, mute control, cleanup, and assets.",
    ),
  )
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
