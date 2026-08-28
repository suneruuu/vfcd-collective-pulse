#pragma once

#include <stddef.h>
#include <stdint.h>

namespace fan_harmony {

enum class PlaybackState : uint8_t {
  ARMING,
  STOPPED,
  PLAYING,
  LOOP_GAP,
  FAULT
};

enum class OutputAction : uint8_t {
  NONE,
  STOP_PULSE,
  PROFILE_SAMPLE
};

struct ControllerEvent {
  OutputAction action;
  size_t sampleIndex;

  static ControllerEvent none() {
    return {OutputAction::NONE, 0};
  }

  static ControllerEvent stopPulse() {
    return {OutputAction::STOP_PULSE, 0};
  }

  static ControllerEvent profileSample(size_t index) {
    return {OutputAction::PROFILE_SAMPLE, index};
  }
};

class PlaybackController {
 public:
  PlaybackController(size_t sampleCount,
                     uint32_t updateIntervalUs,
                     uint32_t armingDurationMs,
                     uint32_t loopGapDurationMs)
      : sampleCount_(sampleCount),
        updateIntervalUs_(updateIntervalUs),
        armingDurationMs_(armingDurationMs),
        loopGapDurationMs_(loopGapDurationMs) {}

  ControllerEvent begin(uint32_t nowUs, uint32_t nowMs) {
    sampleIndex_ = 0;
    nextUpdateUs_ = nowUs;
    armingStartedMs_ = nowMs;

    if (sampleCount_ == 0 || updateIntervalUs_ == 0) {
      state_ = PlaybackState::FAULT;
    } else {
      state_ = PlaybackState::ARMING;
    }

    return ControllerEvent::stopPulse();
  }

  ControllerEvent onButtonPress(uint32_t nowUs, uint32_t nowMs) {
    (void)nowMs;

    switch (state_) {
      case PlaybackState::STOPPED:
        return startPlayback(nowUs);

      case PlaybackState::PLAYING:
      case PlaybackState::LOOP_GAP:
        return stopPlayback();

      case PlaybackState::ARMING:
      case PlaybackState::FAULT:
        return ControllerEvent::none();
    }

    return ControllerEvent::none();
  }

  ControllerEvent start(uint32_t nowUs) {
    if (state_ == PlaybackState::STOPPED ||
        state_ == PlaybackState::LOOP_GAP) {
      return startPlayback(nowUs);
    }
    return ControllerEvent::none();
  }

  ControllerEvent stop() {
    if (state_ == PlaybackState::PLAYING ||
        state_ == PlaybackState::LOOP_GAP ||
        state_ == PlaybackState::STOPPED) {
      return stopPlayback();
    }
    return ControllerEvent::none();
  }

  ControllerEvent update(uint32_t nowUs, uint32_t nowMs) {
    switch (state_) {
      case PlaybackState::ARMING:
        if (elapsed(nowMs, armingStartedMs_, armingDurationMs_)) {
          state_ = PlaybackState::STOPPED;
        }
        return ControllerEvent::none();

      case PlaybackState::STOPPED:
      case PlaybackState::FAULT:
        return ControllerEvent::none();

      case PlaybackState::LOOP_GAP:
        if (elapsed(nowMs, loopGapStartedMs_, loopGapDurationMs_)) {
          return startPlayback(nowUs);
        }
        return ControllerEvent::none();

      case PlaybackState::PLAYING:
        return updatePlayback(nowUs, nowMs);
    }

    return ControllerEvent::none();
  }

  ControllerEvent fault() {
    sampleIndex_ = 0;
    state_ = PlaybackState::FAULT;
    return ControllerEvent::stopPulse();
  }

  PlaybackState state() const {
    return state_;
  }

  size_t sampleIndex() const {
    return sampleIndex_;
  }

 private:
  static bool elapsed(uint32_t now, uint32_t since, uint32_t duration) {
    return static_cast<uint32_t>(now - since) >= duration;
  }

  static bool deadlineReached(uint32_t now, uint32_t deadline) {
    return static_cast<int32_t>(now - deadline) >= 0;
  }

  ControllerEvent startPlayback(uint32_t nowUs) {
    sampleIndex_ = 0;
    nextUpdateUs_ = nowUs + updateIntervalUs_;
    state_ = PlaybackState::PLAYING;
    return ControllerEvent::profileSample(sampleIndex_);
  }

  ControllerEvent stopPlayback() {
    sampleIndex_ = 0;
    state_ = PlaybackState::STOPPED;
    return ControllerEvent::stopPulse();
  }

  ControllerEvent updatePlayback(uint32_t nowUs, uint32_t nowMs) {
    if (!deadlineReached(nowUs, nextUpdateUs_)) {
      return ControllerEvent::none();
    }

    // Normally one command advances on each 50 ms deadline. If the main loop is
    // delayed, skip stale commands instead of issuing a rapid catch-up burst.
    const uint32_t latenessUs = static_cast<uint32_t>(nowUs - nextUpdateUs_);
    const uint32_t steps = 1U + (latenessUs / updateIntervalUs_);
    const size_t remainingSamples = sampleCount_ - sampleIndex_ - 1U;

    if (steps > remainingSamples) {
      sampleIndex_ = 0;
      loopGapStartedMs_ = nowMs;
      state_ = PlaybackState::LOOP_GAP;
      return ControllerEvent::stopPulse();
    }

    sampleIndex_ += steps;
    nextUpdateUs_ += steps * updateIntervalUs_;
    return ControllerEvent::profileSample(sampleIndex_);
  }

  const size_t sampleCount_;
  const uint32_t updateIntervalUs_;
  const uint32_t armingDurationMs_;
  const uint32_t loopGapDurationMs_;

  PlaybackState state_ = PlaybackState::ARMING;
  size_t sampleIndex_ = 0;
  uint32_t nextUpdateUs_ = 0;
  uint32_t armingStartedMs_ = 0;
  uint32_t loopGapStartedMs_ = 0;
};

}  // namespace fan_harmony
