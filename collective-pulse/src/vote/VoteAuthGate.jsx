import { useEffect, useRef, useState } from "react";
import { cloudEnabled, supabase } from "../services/cloudApi.js";
import { createVoteAudio } from "./audio.js";
import { VoteAudioContext } from "./VoteAudioContext.js";
import {
  VOTE_AUTH_MESSAGE,
  beginVoteOAuth,
  completeVoteAuthPopup,
  isVoteAuthPopup,
} from "./popupAuth.js";

export function voteRedirectUrl(
  location = window.location,
  base = (import.meta.env || {}).BASE_URL || "/",
) {
  return new URL("vote/", new URL(base, location.origin)).toString();
}

export function oauthErrorFromLocation(location = window.location) {
  const query = new URLSearchParams(location.search || "");
  const hash = new URLSearchParams((location.hash || "").replace(/^#/, ""));
  return (
    query.get("error_description") ||
    hash.get("error_description") ||
    query.get("error") ||
    hash.get("error") ||
    ""
  );
}

export function VoteAuthShell({ loading, configured, busy, error, onSignIn }) {
  return (
    <main className="vote-screen vote-auth-screen">
      <section className="vote-content vote-auth-content" aria-labelledby="vote-auth-title">
        <p className="vote-auth-brand">FFFF Live Pulse</p>
        <h1 id="vote-auth-title">Sign in to vote</h1>
        {loading ? (
          <p role="status">Checking sign-in...</p>
        ) : (
          <>
            <p className="vote-auth-copy">Use your Google account to join the live vote.</p>
            <button
              className="vote-google-button"
              type="button"
              disabled={!configured || busy}
              onClick={onSignIn}
            >
              {busy ? "Opening Google..." : "Continue with Google"}
            </button>
          </>
        )}
        {error ? <p role="alert">{error}</p> : null}
      </section>
    </main>
  );
}

export default function VoteAuthGate({ children }) {
  const callbackError = oauthErrorFromLocation();
  const [state, setState] = useState({
    loading: cloudEnabled,
    session: null,
    error: callbackError || (cloudEnabled ? "" : "Online voting has not been configured."),
  });
  const [busy, setBusy] = useState(false);
  const [popupCallback] = useState(() => isVoteAuthPopup());
  const popupRef = useRef(null);
  const popupTimerRef = useRef(null);
  const preparedAudioRef = useRef(null);

  function discardPreparedAudio() {
    preparedAudioRef.current?.stop();
    preparedAudioRef.current = null;
  }

  useEffect(() => {
    document.body.classList.add("vote-page");
    let active = true,
      generation = 0;

    if (callbackError) window.history.replaceState(window.history.state, "", voteRedirectUrl());

    if (!supabase) {
      setState({
        loading: false,
        session: null,
        error: "Online voting has not been configured.",
      });
    } else {
      const epoch = ++generation;
      supabase.auth.getSession().then(({ data, error }) => {
        if (!active || epoch !== generation) return;
        setState((current) => ({
          loading: false,
          session: data.session,
          error: error?.message || (data.session ? "" : current.error),
        }));
      });
    }

    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      generation++;
      if (event === "SIGNED_OUT") discardPreparedAudio();
      if (session && popupRef.current) {
        popupRef.current.close();
        popupRef.current = null;
        clearInterval(popupTimerRef.current);
        popupTimerRef.current = null;
        setBusy(false);
      }
      if (active)
        setState((current) => ({
          loading: false,
          session,
          error: session ? "" : current.error,
        }));
    }).data.subscription;

    return () => {
      active = false;
      generation++;
      subscription?.unsubscribe();
      document.body.classList.remove("vote-page");
    };
  }, [callbackError]);

  useEffect(() => {
    if (popupCallback || state.loading || state.session || !supabase || preparedAudioRef.current)
      return;
    preparedAudioRef.current = createVoteAudio({ initialVolume: 0.001 });
  }, [popupCallback, state.loading, state.session]);

  useEffect(() => () => discardPreparedAudio(), []);

  useEffect(() => {
    if (popupCallback) return;
    const onPopupMessage = (event) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== popupRef.current ||
        event.data?.type !== VOTE_AUTH_MESSAGE
      )
        return;
      popupRef.current?.close();
      popupRef.current = null;
      clearInterval(popupTimerRef.current);
      popupTimerRef.current = null;
      setBusy(false);
      if (event.data.error) {
        discardPreparedAudio();
        setState((current) => ({ ...current, error: event.data.error }));
        return;
      }
      const tokens = event.data.tokens;
      if (!tokens?.access_token || !tokens?.refresh_token) {
        discardPreparedAudio();
        setState((current) => ({
          ...current,
          error: "Cannot complete Google sign-in. Try again.",
        }));
        return;
      }
      supabase.auth
        .setSession(tokens)
        .then(({ error }) => {
          if (error) {
            discardPreparedAudio();
            setState((current) => ({ ...current, error: error.message }));
          }
        })
        .catch(() => {
          discardPreparedAudio();
          setState((current) => ({
            ...current,
            error: "Cannot complete Google sign-in. Try again.",
          }));
        });
    };
    window.addEventListener("message", onPopupMessage);
    return () => {
      window.removeEventListener("message", onPopupMessage);
      clearInterval(popupTimerRef.current);
    };
  }, [popupCallback]);

  useEffect(() => {
    if (!popupCallback || state.loading || (!state.session && !state.error)) return;
    completeVoteAuthPopup({ session: state.session, error: state.error });
  }, [popupCallback, state.loading, state.session, state.error]);

  async function signIn() {
    if (!supabase || busy) return;
    setBusy(true);
    setState((current) => ({ ...current, error: "" }));
    try {
      const { popup, error } = await beginVoteOAuth({
        auth: supabase.auth,
        redirectTo: voteRedirectUrl(),
        onBeforePopup: () => {
          if (!preparedAudioRef.current)
            preparedAudioRef.current = createVoteAudio({ initialVolume: 0.001 });
          preparedAudioRef.current.start();
        },
        onPopupUnavailable: discardPreparedAudio,
      });
      if (error) {
        discardPreparedAudio();
        setState((current) => ({ ...current, error: error.message }));
        setBusy(false);
      } else if (popup) {
        popupRef.current = popup;
        popupTimerRef.current = setInterval(() => {
          if (!popup.closed || !document.hasFocus()) return;
          clearInterval(popupTimerRef.current);
          popupTimerRef.current = null;
          if (popupRef.current === popup) {
            popupRef.current = null;
            discardPreparedAudio();
            setBusy(false);
          }
        }, 1000);
      }
    } catch {
      discardPreparedAudio();
      setState((current) => ({ ...current, error: "Cannot connect to Google. Try again." }));
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase || busy) return;
    setBusy(true);
    setState((current) => ({ ...current, error: "" }));
    try {
      const { error } = await supabase.auth.signOut();
      if (error) setState((current) => ({ ...current, error: error.message }));
    } catch {
      setState((current) => ({ ...current, error: "Cannot sign out. Try again." }));
    } finally {
      setBusy(false);
    }
  }

  if (popupCallback)
    return (
      <main className="vote-screen">
        <p role="status">Finishing Google sign-in...</p>
      </main>
    );

  if (!state.session)
    return (
      <VoteAuthShell
        loading={state.loading}
        configured={Boolean(supabase)}
        busy={busy}
        error={state.error}
        onSignIn={signIn}
      />
    );

  return (
    <>
      <VoteAudioContext.Provider value={preparedAudioRef.current}>
        {children}
      </VoteAudioContext.Provider>
      <button className="vote-signout" type="button" disabled={busy} onClick={signOut}>
        {busy ? "Signing out..." : "Sign out"}
      </button>
      {state.error ? (
        <p className="vote-session-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </>
  );
}
