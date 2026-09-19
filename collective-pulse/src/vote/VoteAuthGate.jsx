import { useEffect, useState } from "react";
import { cloudEnabled, supabase } from "../services/cloudApi.js";

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
        <p className="vote-auth-brand">Collective Pulse</p>
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

    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      generation++;
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

  async function signIn() {
    if (!supabase || busy) return;
    setBusy(true);
    setState((current) => ({ ...current, error: "" }));
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: voteRedirectUrl() },
      });
      if (error) setState((current) => ({ ...current, error: error.message }));
    } catch {
      setState((current) => ({ ...current, error: "Cannot connect to Google. Try again." }));
    } finally {
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
      {children}
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
