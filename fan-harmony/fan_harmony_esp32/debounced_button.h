#pragma once

#include <stdint.h>

namespace fan_harmony {

class DebouncedButton {
 public:
  explicit DebouncedButton(uint32_t debounceDurationMs)
      : debounceDurationMs_(debounceDurationMs) {}

  void begin(bool pressed, uint32_t nowMs) {
    rawPressed_ = pressed;
    stablePressed_ = pressed;
    rawChangedMs_ = nowMs;
    readyForPress_ = !pressed;
    initialized_ = true;
  }

  bool update(bool pressed, uint32_t nowMs) {
    if (!initialized_) {
      begin(pressed, nowMs);
      return false;
    }

    if (pressed != rawPressed_) {
      rawPressed_ = pressed;
      rawChangedMs_ = nowMs;
    }

    if (rawPressed_ == stablePressed_ ||
        static_cast<uint32_t>(nowMs - rawChangedMs_) < debounceDurationMs_) {
      return false;
    }

    stablePressed_ = rawPressed_;

    if (!stablePressed_) {
      readyForPress_ = true;
      return false;
    }

    if (!readyForPress_) {
      return false;
    }

    readyForPress_ = false;
    return true;
  }

 private:
  const uint32_t debounceDurationMs_;
  bool initialized_ = false;
  bool rawPressed_ = false;
  bool stablePressed_ = false;
  bool readyForPress_ = false;
  uint32_t rawChangedMs_ = 0;
};

}  // namespace fan_harmony
