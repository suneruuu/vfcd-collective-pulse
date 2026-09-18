import { ApiError } from "./apiError.js";
import { cloudApi, cloudEnabled } from "./cloudApi.js";
export { ApiError } from "./apiError.js";
export function createPromptApi(fetcher = (...args) => fetch(...args)) {
  async function request(url, body, signal) {
    const options = {
      cache: "no-store",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(6000)])
        : AbortSignal.timeout(6000),
    };
    if (body)
      Object.assign(options, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Collective-Pulse": "1",
        },
        body: JSON.stringify(body),
      });
    let response;
    try {
      response = await fetcher(url, options);
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new ApiError("Cannot reach the installation computer. Reconnecting...", 0);
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(
        "The question service is unavailable. Start it on the installation computer.",
        0,
      );
    }
    if (!response.ok)
      throw new ApiError(data.error || "Could not save the queue.", response.status);
    return data;
  }
  return {
    getQueue: (signal) => request("/api/prompts", null, signal),
    updateQueue: (body, signal) => request("/api/prompts", body, signal),
    reportRuntime: (body, signal) => request("/api/runtime", body, signal),
  };
}
export const promptApi = cloudEnabled ? cloudApi : createPromptApi();
