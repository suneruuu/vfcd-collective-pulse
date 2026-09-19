import { createClient } from "@supabase/supabase-js";
import { ApiError } from "./apiError.js";

const env = import.meta.env || {};
export const cloudEnabled = Boolean(env.VITE_SUPABASE_URL || env.VITE_SUPABASE_PUBLISHABLE_KEY);
export const supabase =
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY
    ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY)
    : null;

export function createCloudApi(client) {
  async function rpc(name, args, signal) {
    if (!client) throw new ApiError("Online voting has not been configured.");
    const timeout = AbortSignal.timeout(6000);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let result;
    try {
      result = await client.rpc(name, args).abortSignal(requestSignal);
    } catch {
      throw new ApiError("Connection lost. Reconnecting...");
    }
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    if (result.error) {
      const status = /^PT\d{3}$/.test(result.error.code || "")
        ? Number(result.error.code.slice(2))
        : ["42501", "PGRST301", "PGRST302"].includes(result.error.code)
          ? 403
          : 0;
      throw new ApiError(
        status ? result.error.message : "Cannot reach online voting. Reconnecting...",
        status,
      );
    }
    return result.data;
  }
  return {
    cloud: true,
    getPulse: (after = 0, includeVotes = true, signal) =>
      rpc(
        "pulse_read",
        {
          p_after: after,
          p_include_votes: includeVotes,
        },
        signal,
      ),
    submitVotes: (requestId, choices, signal) =>
      rpc(
        "pulse_submit",
        {
          p_request_id: requestId,
          p_choices: choices,
        },
        signal,
      ),
    submitAuthenticatedVotes: (requestId, choices, signal) =>
      rpc(
        "pulse_submit_authenticated",
        {
          p_request_id: requestId,
          p_choices: choices,
        },
        signal,
      ),
    getQueue: async (signal) =>
      (await rpc("pulse_read", { p_after: 0, p_include_votes: false }, signal)).queue,
    updateQueue: (operation, signal) =>
      rpc("pulse_update_queue", { p_operation: operation }, signal),
    isAdmin: (signal) => rpc("pulse_is_admin", {}, signal),
    reportRuntime: async () => ({ ok: true }),
  };
}
export const cloudApi = createCloudApi(supabase);
