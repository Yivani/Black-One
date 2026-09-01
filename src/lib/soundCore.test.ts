import assert from "node:assert/strict";
import test from "node:test";
import {
  canRepeat,
  MAX_SOUND_SECONDS,
  MAX_TONE_GAIN,
  REPEAT_GUARD_SECONDS,
  SOUND_FAMILIES,
  SOUND_IDS,
  SOUNDS,
  soundDuration,
  soundsInFamily,
  type SoundId,
} from "./soundCore.ts";

/**
 * "Soft" and "small" are the whole point of this sound set, so they are
 * assertions rather than intentions. A future sound that is loud or long
 * fails here instead of being discovered at one in the morning.
 */

// ================================================================ the rules

test("no sound is longer than a third of a second", () => {
  for (const id of SOUND_IDS) {
    const seconds = soundDuration(id);
    assert.ok(
      seconds <= MAX_SOUND_SECONDS,
      `${id} rings for ${seconds}s, longer than ${MAX_SOUND_SECONDS}s`,
    );
    assert.ok(seconds > 0, `${id} is silent`);
  }
});

test("no tone is loud", () => {
  for (const id of SOUND_IDS) {
    for (const tone of SOUNDS[id].tones) {
      assert.ok(
        tone.gain > 0 && tone.gain <= MAX_TONE_GAIN,
        `${id} has a tone at ${tone.gain}, above ${MAX_TONE_GAIN}`,
      );
    }
  }
});

test("the click is the quietest sound there is", () => {
  // It plays on every press in the app. If it is not the quietest thing in
  // the set, the set is wrong.
  const click = Math.max(...SOUNDS.click.tones.map((tone) => tone.gain));
  const loudest = (id: SoundId) =>
    Math.max(...SOUNDS[id].tones.map((tone) => tone.gain));
  for (const id of SOUND_IDS) {
    if (id === "click" || id === "tool") continue;
    assert.ok(loudest(id) >= click, `${id} is quieter than the click`);
  }
});

test("every tone is audible and in a comfortable range", () => {
  for (const id of SOUND_IDS) {
    for (const tone of SOUNDS[id].tones) {
      // Below ~200 Hz a laptop speaker reproduces nothing but a rattle;
      // above ~2.5 kHz a repeated tone becomes piercing.
      assert.ok(
        tone.frequency >= 200 && tone.frequency <= 2500,
        `${id} has a tone at ${tone.frequency} Hz`,
      );
      assert.ok(tone.duration > 0, `${id} has a zero-length tone`);
      assert.ok(tone.at >= 0, `${id} has a tone before the start`);
    }
  }
});

test("tones are listed in the order they play", () => {
  for (const id of SOUND_IDS) {
    const offsets = SOUNDS[id].tones.map((tone) => tone.at);
    assert.deepEqual(offsets, [...offsets].sort((a, b) => a - b), id);
  }
});

test("a multi-tone sound reads as one sound, not two beeps", () => {
  // Notes may overlap, or sit in a deliberate double like the error sound,
  // but a real gap between them is heard as two separate events.
  const MAX_GAP = 0.03;
  for (const id of SOUND_IDS) {
    const tones = SOUNDS[id].tones;
    for (let i = 1; i < tones.length; i += 1) {
      const gap = tones[i].at - (tones[i - 1].at + tones[i - 1].duration);
      assert.ok(
        gap <= MAX_GAP,
        `${id}: tone ${i} starts ${gap}s after the last one died away`,
      );
    }
  }
});

// ============================================================== the mapping

test("every sound belongs to a family that exists", () => {
  const known = new Set(SOUND_FAMILIES.map((family) => family.id));
  for (const id of SOUND_IDS) {
    assert.ok(known.has(SOUNDS[id].family), `${id} is in no known family`);
  }
});

test("every family has sounds in it", () => {
  for (const family of SOUND_FAMILIES) {
    assert.ok(
      soundsInFamily(family.id).length > 0,
      `${family.id} is an empty switch`,
    );
  }
});

test("the families partition the set, with nothing left out", () => {
  const grouped = SOUND_FAMILIES.flatMap((family) => soundsInFamily(family.id));
  assert.equal(grouped.length, SOUND_IDS.length);
  assert.deepEqual([...grouped].sort(), [...SOUND_IDS].sort());
});

test("every sound is named for the settings list", () => {
  const keys = SOUND_IDS.map((id) => SOUNDS[id].labelKey);
  for (const key of keys) assert.match(key, /^haptics\.sound[A-Z]/);
  assert.equal(new Set(keys).size, keys.length, "two sounds share a label");
});

test("the events an agent produces are covered", () => {
  // The point of the set: the things this app actually does each sound
  // different, rather than one tick for everything.
  for (const id of [
    "click", "toggle", "send", "complete", "cancel",
    "error", "notify", "tool", "memory", "terminal", "task",
  ] as SoundId[]) {
    assert.ok(SOUNDS[id], `${id} is missing`);
  }
});

test("no two sounds are the same noise", () => {
  const shapes = SOUND_IDS.map((id) =>
    JSON.stringify(SOUNDS[id].tones.map((tone) => [tone.frequency, tone.wave])),
  );
  assert.equal(
    new Set(shapes).size,
    shapes.length,
    "two events would be indistinguishable by ear",
  );
});

// =========================================================== repeat guard

test("the same sound cannot machine-gun", () => {
  const guard = REPEAT_GUARD_SECONDS * 1000;
  assert.equal(canRepeat(undefined, 1_000), true, "the first play is allowed");
  assert.equal(canRepeat(1_000, 1_000 + guard - 1), false);
  assert.equal(canRepeat(1_000, 1_000 + guard), true);
});

test("the guard is short enough to keep deliberate presses responsive", () => {
  // Someone clicking quickly still hears every press; only a held key or a
  // loop firing dozens of events a second is thinned out.
  assert.ok(REPEAT_GUARD_SECONDS <= 0.06, "presses would be swallowed");
});
