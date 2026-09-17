"use client";

import { useState } from "react";

/**
 * Booking picker: choose a day, then a time.
 *
 * Days are exercise-local ("Day 3"), never real calendar dates — the supplied
 * record states that no real event date is implied, so a real date picker would
 * be a false claim. The interaction is the familiar one: a day strip and a grid
 * of times.
 */
export function SlotPicker({
  days,
  times,
  currentSlot,
  disabled,
  onPick,
}: {
  days: string[];
  times: string[];
  currentSlot: string;
  disabled?: boolean;
  onPick: (slot: string) => void;
}) {
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);

  const chosen = day && time ? `${day} at ${time}` : null;
  const isCurrent = (d: string, t: string) =>
    currentSlot.replace(",", "").toLowerCase().includes(d.toLowerCase()) &&
    currentSlot.includes(t);

  return (
    <div className="space-y-3">
      <div>
        <p className="section-title mb-2">Choose a day</p>
        <div className="flex gap-2 flex-wrap">
          {days.map((d) => {
            const active = d === day;
            return (
              <button
                key={d}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setDay(d);
                  setTime(null);
                }}
                className="btn btn-sm"
                style={
                  active
                    ? { borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--accent)" }
                    : undefined
                }
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {day && (
        <div className="anim-rise">
          <p className="section-title mb-2">Choose a time on {day}</p>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(5rem, 1fr))" }}
          >
            {times.map((t) => {
              const current = isCurrent(day, t);
              const active = t === time;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={disabled || current}
                  title={current ? "This is your current appointment" : undefined}
                  onClick={() => setTime(t)}
                  className="btn btn-sm mono"
                  style={
                    active
                      ? { borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--accent)" }
                      : undefined
                  }
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {chosen && (
        <div className="anim-rise flex items-center gap-3 flex-wrap">
          <button
            type="button"
            className="btn btn-primary"
            disabled={disabled}
            onClick={() => {
              onPick(chosen);
              setDay(null);
              setTime(null);
            }}
          >
            Request {chosen}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={disabled}
            onClick={() => {
              setDay(null);
              setTime(null);
            }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
