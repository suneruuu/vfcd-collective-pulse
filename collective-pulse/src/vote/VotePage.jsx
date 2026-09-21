import { useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cloudApi } from "../services/cloudApi.js";
import { createCloudConnection, campaignIsActive } from "../services/cloudConnection.js";
import { createVoteAudio } from "./audio.js";
import { VoteAudioContext } from "./VoteAudioContext.js";
import { createResponseInput } from "./responseInput.js";
import "./vote.css";

const authenticatedVoteApi = Object.freeze({
  getPulse: (...args) => cloudApi.getPulse(...args),
  submitVotes: (...args) => cloudApi.submitAuthenticatedVotes(...args),
});

export function VoteShell({
  enabled,
  message = "",
  status = "",
  input,
  soundStatus = "playing",
  onToggleSound,
}) {
  const soundBlocked = soundStatus === "blocked";
  const soundOn = soundStatus === "playing";
  return (
    <main className="vote-screen">
      <button
        className="vote-audio-toggle"
        type="button"
        aria-label={soundBlocked ? "Start background sound" : "Background sound"}
        aria-pressed={soundOn}
        data-needs-gesture={soundBlocked}
        onClick={onToggleSound}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 9v6h4l5 4V5L7 9H3Z" />
          {soundOn ? (
            <>
              <path d="M16 9a4 4 0 0 1 0 6" />
              <path d="M19 6a8 8 0 0 1 0 12" />
            </>
          ) : (
            <path d="m16 9 5 6m0-6-5 6" />
          )}
        </svg>
      </button>
      <section className="vote-content" aria-labelledby="vote-question">
        <h1 id="vote-question">
          Does Vietnam
          <br />
          need an annual
          <br />
          Creative
          <br />
          Festival?
        </h1>
        <div className="vote-buttons">
          {[
            { choice: 1, text: "YES" },
            { choice: -1, text: "NO" },
          ].map(({ choice, text }) => (
            <button
              key={choice}
              className={choice === 1 ? "vote-yes" : "vote-no"}
              type="button"
              disabled={!enabled}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                input.press("pointer:" + event.pointerId, choice);
              }}
              onPointerUp={(event) => input.release("pointer:" + event.pointerId)}
              onPointerCancel={(event) => input.release("pointer:" + event.pointerId)}
              onLostPointerCapture={(event) => input.release("pointer:" + event.pointerId)}
              onBlur={() => input.release("button:" + text)}
              onKeyDown={(event) => {
                if (![" ", "Enter"].includes(event.key)) return;
                event.preventDefault();
                if (!event.repeat) input.press("button:" + text, choice);
              }}
              onKeyUp={(event) => {
                if ([" ", "Enter"].includes(event.key)) {
                  event.preventDefault();
                  input.release("button:" + text);
                }
              }}
              onClick={(event) => {
                if (event.detail === 0) input.tap(choice);
              }}
            >
              <span>{text}</span>
            </button>
          ))}
        </div>
        <p className="vote-message" role="status">
          {message}
        </p>
        <p className="sr-only" aria-live="polite">
          {status}
        </p>
      </section>
    </main>
  );
}

export default function VotePage({ api = authenticatedVoteApi }) {
  const connectionRef = useRef(null);
  if (!connectionRef.current)
    connectionRef.current = createCloudConnection({ api, includeVotes: false });
  const connection = connectionRef.current;
  const state = useSyncExternalStore(
    connection.subscribe,
    connection.getSnapshot,
    connection.getSnapshot,
  );
  const [, tick] = useState(0);
  const [soundStatus, setSoundStatus] = useState("starting");
  const preparedAudio = useContext(VoteAudioContext);
  const audioRef = useRef(null);
  const inputRef = useRef(null);
  if (!inputRef.current)
    inputRef.current = createResponseInput({
      canVote: connection.canVote,
      submit: connection.submit,
      now: connection.now,
    });
  const input = inputRef.current;
  useEffect(() => {
    const audio = preparedAudio || createVoteAudio({ onStatusChange: setSoundStatus });
    if (preparedAudio) {
      audio.setStatusListener(setSoundStatus);
      audio.setVolume(0.4);
    }
    audioRef.current = audio;
    audio.start();
    const unlockAudio = (event) => {
      if (event.target instanceof Element && event.target.closest(".vote-audio-toggle")) return;
      audio.start();
    };
    const retryWhenVisible = () => {
      if (!document.hidden) audio.start();
    };
    document.addEventListener("pointerdown", unlockAudio);
    document.addEventListener("keydown", unlockAudio);
    document.addEventListener("visibilitychange", retryWhenVisible);
    window.addEventListener("focus", retryWhenVisible);
    return () => {
      document.removeEventListener("pointerdown", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
      document.removeEventListener("visibilitychange", retryWhenVisible);
      window.removeEventListener("focus", retryWhenVisible);
      if (preparedAudio) audio.setStatusListener(() => {});
      else audio.stop();
      audioRef.current = null;
    };
  }, [preparedAudio]);

  function toggleSound() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.getStatus() === "blocked") {
      audio.start();
      return;
    }
    audio.setEnabled(!audio.isEnabled());
  }

  useEffect(() => {
    connection.start();
    const interval = setInterval(() => {
      input.sample();
      tick((value) => value + 1);
    }, 100);
    window.addEventListener("online", connection.syncOnce);
    window.addEventListener("blur", input.reset);
    document.addEventListener("visibilitychange", input.reset);
    const unsubscribe = connection.subscribe(() => {
      if (!connection.canVote()) input.reset();
    });
    return () => {
      connection.stop();
      input.reset();
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener("online", connection.syncOnce);
      window.removeEventListener("blur", input.reset);
      document.removeEventListener("visibilitychange", input.reset);
    };
  }, [connection, input]);
  const active = campaignIsActive(state.campaign, connection.now());
  const message = !state.connected
    ? state.message
    : !active
      ? "Voting is open September 21–27, 09:00–18:00 Vietnam time."
      : "";
  return (
    <VoteShell
      enabled={state.connected && active}
      message={message}
      status={state.message}
      input={input}
      soundStatus={soundStatus}
      onToggleSound={toggleSound}
    />
  );
}
