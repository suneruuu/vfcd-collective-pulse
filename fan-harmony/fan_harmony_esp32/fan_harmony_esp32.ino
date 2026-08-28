#include <Arduino.h>
#include <esp_arduino_version.h>
#include <pgmspace.h>

#include "debounced_button.h"
#include "playback_controller.h"
#include "profile_data.h"

namespace config {

constexpr uint8_t kEscPin = 13;  // Board pin 13.
constexpr uint8_t kButtonPin = 27;
constexpr uint8_t kPwmChannel = 0;

constexpr uint32_t kPwmFrequencyHz = 50;
constexpr uint32_t kPwmPeriodUs = 1000000UL / kPwmFrequencyHz;
constexpr uint8_t kPwmResolutionBits = 14;
constexpr uint32_t kPwmMaximumDuty = (1UL << kPwmResolutionBits) - 1UL;

constexpr uint16_t kStopPulseUs = 1000;
constexpr uint16_t kMaximumPulseUs = 2000;
constexpr uint16_t kTestMaximumPulseUs = 1400;
constexpr uint32_t kArmingDurationMs = 3000;
constexpr uint32_t kLoopGapDurationMs = 1000;
constexpr uint32_t kButtonDebounceMs = 40;

static_assert(kStopPulseUs < kMaximumPulseUs, "Invalid ESC pulse range");
static_assert(kMaximumPulseUs < kPwmPeriodUs, "ESC pulse must fit in one PWM period");

}  // namespace config

using fan_harmony::ControllerEvent;
using fan_harmony::DebouncedButton;
using fan_harmony::OutputAction;
using fan_harmony::PlaybackController;
using fan_harmony::PlaybackState;

DebouncedButton button(config::kButtonDebounceMs);
PlaybackController controller(fan_profile::kCommandCount,
                              fan_profile::kUpdateIntervalUs,
                              config::kArmingDurationMs,
                              config::kLoopGapDurationMs);

bool pwmReady = false;
uint16_t lastCommandedPulseUs = config::kStopPulseUs;
char serialCommand[16] = {};
size_t serialCommandLength = 0;

uint32_t pulseUsToDuty(uint16_t pulseUs) {
  if (pulseUs < config::kStopPulseUs) {
    pulseUs = config::kStopPulseUs;
  } else if (pulseUs > config::kMaximumPulseUs) {
    pulseUs = config::kMaximumPulseUs;
  }

  const uint64_t scaled =
      static_cast<uint64_t>(pulseUs) * config::kPwmMaximumDuty +
      (config::kPwmPeriodUs / 2U);
  return static_cast<uint32_t>(scaled / config::kPwmPeriodUs);
}

bool attachEscPwm() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  return ledcAttach(config::kEscPin,
                    config::kPwmFrequencyHz,
                    config::kPwmResolutionBits);
#else
  const double actualFrequency =
      ledcSetup(config::kPwmChannel,
                config::kPwmFrequencyHz,
                config::kPwmResolutionBits);
  if (actualFrequency <= 0.0) {
    return false;
  }
  ledcAttachPin(config::kEscPin, config::kPwmChannel);
  return true;
#endif
}

bool writeEscPulse(uint16_t pulseUs) {
  if (!pwmReady) {
    return false;
  }

  const uint32_t duty = pulseUsToDuty(pulseUs);

#if ESP_ARDUINO_VERSION_MAJOR >= 3
  const bool success = ledcWrite(config::kEscPin, duty);
  if (success) {
    lastCommandedPulseUs = pulseUs;
  }
  return success;
#else
  ledcWrite(config::kPwmChannel, duty);
  lastCommandedPulseUs = pulseUs;
  return true;
#endif
}

uint16_t readProfilePulse(size_t sampleIndex) {
  return pgm_read_word(fan_profile::kCommandsUs + sampleIndex);
}

void reportTransition(PlaybackState previous, PlaybackState current) {
  if (previous == current) {
    return;
  }

  if (previous == PlaybackState::ARMING && current == PlaybackState::STOPPED) {
    Serial.println("ESC armed; controller is STOPPED.");
  } else if (previous == PlaybackState::STOPPED && current == PlaybackState::PLAYING) {
    Serial.println("Playback started at sample 0.");
  } else if (previous == PlaybackState::PLAYING && current == PlaybackState::STOPPED) {
    Serial.println("Playback stopped and rewound.");
  } else if (previous == PlaybackState::PLAYING && current == PlaybackState::LOOP_GAP) {
    Serial.println("Profile complete; entering 1-second LOOP_GAP at 1000 us.");
  } else if (previous == PlaybackState::LOOP_GAP && current == PlaybackState::PLAYING) {
    Serial.println("LOOP_GAP complete; restarting at sample 0.");
  } else if (previous == PlaybackState::LOOP_GAP && current == PlaybackState::STOPPED) {
    Serial.println("Loop restart cancelled; controller remains STOPPED.");
  } else if (current == PlaybackState::FAULT) {
    Serial.println("FAULT: PWM output is unavailable; playback disabled.");
  }
}

bool applyControllerEvent(const ControllerEvent& event) {
  switch (event.action) {
    case OutputAction::NONE:
      return true;

    case OutputAction::STOP_PULSE:
      return writeEscPulse(config::kStopPulseUs);

    case OutputAction::PROFILE_SAMPLE:
      if (event.sampleIndex >= fan_profile::kCommandCount) {
        return false;
      }
      return writeEscPulse(readProfilePulse(event.sampleIndex));
  }

  return false;
}

void processControllerEvent(PlaybackState previous,
                            const ControllerEvent& event) {
  if (!applyControllerEvent(event)) {
    controller.fault();
    pwmReady = false;
    reportTransition(previous, controller.state());
    return;
  }

  reportTransition(previous, controller.state());
}

const char* stateName(PlaybackState state) {
  switch (state) {
    case PlaybackState::ARMING:
      return "ARMING";
    case PlaybackState::STOPPED:
      return "STOPPED";
    case PlaybackState::PLAYING:
      return "PLAYING";
    case PlaybackState::LOOP_GAP:
      return "LOOP_GAP";
    case PlaybackState::FAULT:
      return "FAULT";
  }
  return "UNKNOWN";
}

void runSerialCommand() {
  serialCommand[serialCommandLength] = '\0';
  const PlaybackState previous = controller.state();
  ControllerEvent event = ControllerEvent::none();
  bool explicitStopCommand = false;

  if (strncmp(serialCommand, "TEST ", 5) == 0) {
    if (controller.state() != PlaybackState::STOPPED) {
      Serial.println("TEST is allowed only while STOPPED. Send STOP first.");
      return;
    }

    char* parseEnd = nullptr;
    const long requestedPulse = strtol(serialCommand + 5, &parseEnd, 10);
    if (parseEnd == serialCommand + 5 || *parseEnd != '\0' ||
        requestedPulse < config::kStopPulseUs ||
        requestedPulse > config::kTestMaximumPulseUs) {
      Serial.printf("Invalid test pulse. Use TEST %u through TEST %u.\n",
                    config::kStopPulseUs,
                    config::kTestMaximumPulseUs);
      return;
    }

    if (!writeEscPulse(static_cast<uint16_t>(requestedPulse))) {
      controller.fault();
      pwmReady = false;
      Serial.println("FAULT: could not apply test pulse.");
      return;
    }

    Serial.printf("Fixed test pulse set to %ld us. Send STOP to return to 1000 us.\n",
                  requestedPulse);
    return;
  } else if (strcmp(serialCommand, "TEST") == 0) {
    Serial.printf("Usage: TEST <pulse>, from %u through %u us.\n",
                  config::kStopPulseUs,
                  config::kTestMaximumPulseUs);
    return;
  } else if (strcmp(serialCommand, "START") == 0 || strcmp(serialCommand, "1") == 0) {
    event = controller.start(micros());
  } else if (strcmp(serialCommand, "STOP") == 0 || strcmp(serialCommand, "0") == 0) {
    event = controller.stop();
    explicitStopCommand = true;
  } else if (strcmp(serialCommand, "TOGGLE") == 0) {
    event = controller.onButtonPress(micros(), millis());
  } else if (strcmp(serialCommand, "STATUS") == 0) {
    Serial.printf("State=%s, sample=%u/%u, pulse=%u us\n",
                  stateName(controller.state()),
                  static_cast<unsigned>(controller.sampleIndex()),
                  static_cast<unsigned>(fan_profile::kCommandCount),
                  lastCommandedPulseUs);
    return;
  } else if (serialCommandLength != 0) {
    Serial.println("Unknown command. Use START, STOP, TOGGLE, STATUS, or TEST <pulse>.");
    return;
  }

  processControllerEvent(previous, event);
  if (explicitStopCommand && controller.state() == PlaybackState::STOPPED) {
    Serial.printf("Stop pulse set to %u us.\n", config::kStopPulseUs);
  }
  if (previous == controller.state() && event.action == OutputAction::NONE &&
      serialCommandLength != 0) {
    Serial.printf("Command ignored while state is %s.\n", stateName(controller.state()));
  }
}

void serviceSerialCommands() {
  while (Serial.available() > 0) {
    const char incoming = static_cast<char>(Serial.read());

    if (incoming == '\r') {
      continue;
    }

    if (incoming == '\n') {
      runSerialCommand();
      serialCommandLength = 0;
      continue;
    }

    if (serialCommandLength < sizeof(serialCommand) - 1U) {
      if (incoming >= 'a' && incoming <= 'z') {
        serialCommand[serialCommandLength++] = incoming - ('a' - 'A');
      } else {
        serialCommand[serialCommandLength++] = incoming;
      }
    }
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(config::kButtonPin, INPUT_PULLUP);
  const uint32_t nowMs = millis();
  button.begin(digitalRead(config::kButtonPin) == LOW, nowMs);

  pwmReady = attachEscPwm();
  if (!pwmReady) {
    controller.fault();
    Serial.println("FAULT: could not configure 50 Hz LEDC output.");
    return;
  }

  const ControllerEvent event = controller.begin(micros(), nowMs);
  if (!applyControllerEvent(event)) {
    controller.fault();
    pwmReady = false;
    Serial.println("FAULT: could not command the ESC stop pulse.");
    return;
  }

  Serial.printf("Arming ESC at %u us for %lu ms...\n",
                config::kStopPulseUs,
                static_cast<unsigned long>(config::kArmingDurationMs));
  Serial.println("Controls: START, STOP, TOGGLE, STATUS, TEST <1000-1400>.");
}

void loop() {
  serviceSerialCommands();

  uint32_t nowMs = millis();
  const bool rawButtonPressed = digitalRead(config::kButtonPin) == LOW;

  // Handle the button before timed transitions. This guarantees that a press
  // during LOOP_GAP cancels its pending automatic restart.
  if (button.update(rawButtonPressed, nowMs)) {
    const PlaybackState previous = controller.state();
    const ControllerEvent event = controller.onButtonPress(micros(), nowMs);
    processControllerEvent(previous, event);
  }

  // If a press begins near the end of LOOP_GAP, wait for its debounce result
  // instead of restarting for a few milliseconds and then stopping again.
  if (controller.state() == PlaybackState::LOOP_GAP && rawButtonPressed) {
    return;
  }

  nowMs = millis();
  const uint32_t nowUs = micros();
  const PlaybackState previous = controller.state();
  const ControllerEvent event = controller.update(nowUs, nowMs);
  processControllerEvent(previous, event);
}
