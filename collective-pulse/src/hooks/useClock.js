import { useEffect, useState } from "react";
export function useClock(externalNow) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (externalNow !== undefined) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [externalNow]);
  return externalNow ?? now;
}
