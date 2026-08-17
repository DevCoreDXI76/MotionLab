/**
 * "cast-builder" — see docs/remotion_트레이드오프_claudecode인계.md 항목 15.
 *
 * We don't record a terminal session (no TTY available in the agent's
 * execution environment, and screen/desktop capture is banned outright
 * after the 2026-08-16 incident). Instead we BUILD an asciinema-v2-shaped
 * event stream from real, non-interactively captured command output —
 * capturing stdout via a child process needs no TTY at all — and layer
 * synthetic timing on top (typing speed for what was "typed", a short
 * pause before output "appears"). The realism comes from the output being
 * genuine; the timing is a directed value like any other animation
 * parameter, which is actually an advantage: it can be scaled to fit a
 * scene's duration exactly (see scaleCastToDuration), something a real
 * recording could never do without speeding up/slowing down audio-like
 * artifacts.
 */

export interface CastSegment {
  /** "input": typed out character-by-character. "output": revealed as one block after a short pause. */
  kind: "input" | "output";
  text: string;
}

export interface CastEvent {
  /** Seconds from the start of the cast. */
  time: number;
  type: "o";
  data: string;
}

export interface Cast {
  header: { version: 2; width: number; height: number; timestamp: number };
  events: CastEvent[];
}

const CHARS_PER_SEC_TYPING = 18;
const OUTPUT_REVEAL_DELAY_SEC = 0.4;
const INTER_SEGMENT_GAP_SEC = 0.3;

/** Builds a synthetic-timing cast from real (segment.text) content. */
export function buildCast(segments: CastSegment[], opts: { width: number; height: number }): Cast {
  const events: CastEvent[] = [];
  let t = 0;

  for (const segment of segments) {
    if (segment.kind === "input") {
      for (const ch of segment.text) {
        events.push({ time: t, type: "o", data: ch });
        t += 1 / CHARS_PER_SEC_TYPING;
      }
      events.push({ time: t, type: "o", data: "\r\n" });
      t += INTER_SEGMENT_GAP_SEC;
    } else {
      t += OUTPUT_REVEAL_DELAY_SEC;
      events.push({ time: t, type: "o", data: segment.text });
      events.push({ time: t, type: "o", data: "\r\n" });
      t += INTER_SEGMENT_GAP_SEC;
    }
  }

  return { header: { version: 2, width: opts.width, height: opts.height, timestamp: 0 }, events };
}

/** Total synthetic duration of a cast, in seconds (time of its last event). */
export function castDurationSeconds(cast: Cast): number {
  if (cast.events.length === 0) return 0;
  return cast.events[cast.events.length - 1].time;
}

/**
 * Rescales every event's timestamp so the cast's total duration becomes
 * exactly `targetSeconds` — lets a scene's real (audio-measured) duration
 * dictate playback speed instead of the other way around.
 */
export function scaleCastToDuration(cast: Cast, targetSeconds: number): Cast {
  const original = castDurationSeconds(cast);
  if (original <= 0 || targetSeconds <= 0) return cast;
  const factor = targetSeconds / original;
  return {
    header: cast.header,
    events: cast.events.map((e) => ({ ...e, time: e.time * factor })),
  };
}

/** Concatenates every event's data up to and including `atSeconds` — the terminal's visible buffer at that moment. */
export function renderCastAt(cast: Cast, atSeconds: number): string {
  let out = "";
  for (const event of cast.events) {
    if (event.time > atSeconds) break;
    out += event.data;
  }
  return out;
}

/** Returns only the last `maxLines` lines of `text` — mimics a terminal that scrolls to keep the newest output in view. */
export function tailLines(text: string, maxLines: number): string {
  const lines = text.split(/\r?\n/);
  if (lines.length <= maxLines) return text;
  return lines.slice(lines.length - maxLines).join("\n");
}
