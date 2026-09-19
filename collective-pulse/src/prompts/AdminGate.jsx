import { useEffect, useState } from "react";
import { cloudApi, cloudEnabled, supabase } from "../services/cloudApi.js";
import "./admin.css";

export default function AdminGate({ children }) {
  const [state, setState] = useState({ loading: true, allowed: false, session: null, error: "" });
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!cloudEnabled) return;
    document.body.classList.add("admin-page");
    let active = true,
      generation = 0;
    const timers = new Set();
    async function check(session) {
      const epoch = ++generation;
      if (!session) {
        if (active) setState({ loading: false, allowed: false, session: null, error: "" });
        return;
      }
      try {
        const allowed = await cloudApi.isAdmin();
        if (active && epoch === generation)
          setState({
            loading: false,
            allowed,
            session,
            error: allowed ? "" : "This account does not have administrator access.",
          });
      } catch (error) {
        if (active && epoch === generation)
          setState({ loading: false, allowed: false, session, error: error.message });
      }
    }
    if (!supabase)
      setState({
        loading: false,
        allowed: false,
        session: null,
        error: "Online management has not been configured.",
      });
    else {
      supabase.auth.getSession().then(({ data, error }) => {
        if (!active) return;
        if (error)
          setState({ loading: false, allowed: false, session: null, error: error.message });
        else void check(data.session);
      });
    }
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      // Avoid making another Supabase request while the auth callback holds its lock.
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (active) void check(session);
      }, 0);
      timers.add(timer);
    }).data.subscription;
    return () => {
      active = false;
      generation++;
      subscription?.unsubscribe();
      for (const timer of timers) clearTimeout(timer);
      document.body.classList.remove("admin-page");
    };
  }, [retry]);
  if (!cloudEnabled) return children;
  async function login(event) {
    event.preventDefault();
    if (!supabase || busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.get("email"),
        password: form.get("password"),
      });
      if (error) setState((current) => ({ ...current, error: error.message }));
    } catch {
      setState((current) => ({ ...current, error: "Cannot connect. Try again." }));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) setState((current) => ({ ...current, error: error.message }));
  }
  if (state.allowed)
    return (
      <>
        {children}
        <button className="admin-signout" onClick={logout} type="button">
          Sign out
        </button>
      </>
    );
  return (
    <main className="admin-screen">
      <form className="admin-form" onSubmit={login}>
        <p>FFFF Live Pulse</p>
        <h1>Question manager</h1>
        {state.loading ? (
          <p role="status">Checking access...</p>
        ) : state.session ? (
          <>
            <p role="alert">{state.error}</p>
            <button
              type="button"
              onClick={() => {
                setState((current) => ({ ...current, loading: true }));
                setRetry((value) => value + 1);
              }}
            >
              Retry
            </button>{" "}
            <button type="button" onClick={logout}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                disabled={!supabase || busy}
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={!supabase || busy}
              />
            </label>
            <button type="submit" disabled={!supabase || busy}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
            <p role="alert">{state.error}</p>
          </>
        )}
      </form>
    </main>
  );
}
