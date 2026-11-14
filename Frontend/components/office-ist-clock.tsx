"use client";

import { useEffect, useState } from "react";

const zone = "Asia/Kolkata";
const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: zone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: zone, day: "2-digit", month: "short", year: "numeric",
});
const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: zone, day: "2-digit", month: "2-digit",
});

/** Browser time is the current device clock rendered explicitly as IST.
 * No geolocation, network request, fixed timestamp or server hydration guess. */
export function OfficeIstClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  return <time className="office-ist-clock" dateTime={now?.toISOString()}
    title="India Standard Time · Asia/Kolkata"
    aria-label={now ? "India Standard Time: " + clockFormatter.format(now) + ", " + dateFormatter.format(now) : "India Standard Time loading"}>
    <span className="office-ist-clock-time" aria-hidden="true">
      {now ? clockFormatter.format(now).slice(0, 5) : "--:--"}
      <span className="office-ist-clock-seconds">{now ? clockFormatter.format(now).slice(5) : ":--"}</span>
    </span>
    <span className="office-ist-clock-separator" aria-hidden="true">•</span>
    <span className="office-ist-clock-date" aria-hidden="true">{now ? dateFormatter.format(now) : "-- --- ----"}</span>
    <span className="office-ist-clock-date-small" aria-hidden="true">{now ? shortDateFormatter.format(now) : "--/--"}</span>
    <span className="office-ist-clock-zone" aria-hidden="true">IST</span>
  </time>;
}
