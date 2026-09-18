import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cloudApi } from "../services/cloudApi.js";
import { createCloudConnection, campaignIsActive } from "../services/cloudConnection.js";
import { createResponseInput } from "./responseInput.js";
import "./vote.css";

export function VoteShell({ enabled, message = "", status = "", input }) {
  return (
    <main className="vote-screen">
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

export default function VotePage() {
  const connectionRef = useRef(null);
  if (!connectionRef.current)
    connectionRef.current = createCloudConnection({ api: cloudApi, includeVotes: false });
  const connection = connectionRef.current;
  const state = useSyncExternalStore(
    connection.subscribe,
    connection.getSnapshot,
    connection.getSnapshot,
  );
  const [, tick] = useState(0);
  const inputRef = useRef(null);
  if (!inputRef.current)
    inputRef.current = createResponseInput({
      canVote: connection.canVote,
      submit: connection.submit,
      now: connection.now,
    });
  const input = inputRef.current;
  useEffect(() => {
    document.body.classList.add("vote-page");
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
      document.body.classList.remove("vote-page");
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
    />
  );
}
