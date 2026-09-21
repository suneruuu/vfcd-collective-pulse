export const VOTE_AUTH_POPUP_KEY = "collective-pulse-vote-auth-popup";
export const VOTE_AUTH_MESSAGE = "collective-pulse-vote-auth";

export function openVoteAuthPopup(windowRef = globalThis.window) {
  let popup;
  try {
    popup = windowRef.open("", "_blank", "popup,width=520,height=720");
    if (!popup) return null;
    popup.sessionStorage.setItem(VOTE_AUTH_POPUP_KEY, "1");
    return popup;
  } catch {
    popup?.close?.();
    return null;
  }
}

export function isVoteAuthPopup(windowRef = globalThis.window) {
  try {
    return windowRef.sessionStorage.getItem(VOTE_AUTH_POPUP_KEY) === "1";
  } catch {
    return false;
  }
}

export async function beginVoteOAuth({
  auth,
  redirectTo,
  windowRef = globalThis.window,
  onBeforePopup = () => {},
  onPopupUnavailable = () => {},
}) {
  onBeforePopup();
  const popup = openVoteAuthPopup(windowRef);
  if (!popup) onPopupUnavailable();
  try {
    const { data, error } = await auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: Boolean(popup) },
    });
    if (error) {
      popup?.close?.();
      return { popup: null, error };
    }
    if (popup) {
      if (!data?.url) {
        popup.close();
        return { popup: null, error: new Error("Cannot open Google. Try again.") };
      }
      try {
        popup.location.replace(data.url);
      } catch {
        popup.close();
        windowRef.location.assign(data.url);
        return { popup: null, error: null };
      }
    }
    return { popup, error: null };
  } catch (error) {
    popup?.close?.();
    throw error;
  }
}

export function completeVoteAuthPopup({ session, error, windowRef = globalThis.window }) {
  if (!isVoteAuthPopup(windowRef)) return false;
  windowRef.sessionStorage.removeItem(VOTE_AUTH_POPUP_KEY);
  windowRef.opener?.postMessage(
    {
      type: VOTE_AUTH_MESSAGE,
      tokens: session
        ? { access_token: session.access_token, refresh_token: session.refresh_token }
        : null,
      error: error || "",
    },
    windowRef.location.origin,
  );
  windowRef.close();
  return true;
}
