/**
 * The app's sound set.
 *
 * Every sound is *synthesized* rather than loaded from a file. Three reasons,
 * in order of how much they matter:
 *
 * 1. **Softness is a property, not a hope.** A shipped wav is whatever it is;
 *    here the envelope, the peak level and the length are values this module
 *    can hold every sound to. Nothing can be harsh by accident.
 * 2. **No latency.** A click has to be heard on the press, not after a fetch
 *    and a decode. There is nothing to load.
 * 3. **Variations are cheap.** Giving eleven different events their own voice
 *    costs eleven small tables here rather than eleven audio files.
 *
 * The whole set is built from short sine and triangle tones on notes that are
 * consonant with each other, so two sounds landing close together still sound
 * deliberate.
 *
 * Import-free: the shape of every sound is unit-tested without an audio device.
 */

/** Note frequencies, named so a definition below reads as music. */
const NOTE = {
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  B5: 987.77,
  C6: 1046.5,
  D6: 1174.66,
  E6: 1318.51,
  G6: 1567.98,
  B6: 1975.53,
  Ds4: 311.13,
  Gs5: 830.61,
} as const;

export type Waveform = "sine" | "triangle";

/** One tone in a sound. A sound is one to three of these. */
export interface Tone {
  /** Hz. */
  frequency: number;
  /** Seconds after the start of the sound. */
  at: number;
  /** Seconds the tone rings for, envelope included. */
  duration: number;
  /**
   * Peak level relative to the user's volume setting, 0..1.
   *
   * These are *relative to each other*: a click is quieter than a completion
   * because it happens a hundred times more often, not because it is far away.
   */
  gain: number;
  wave: Waveform;
}

/** What a sound is for. Each family can be switched off on its own. */
export type SoundFamily = "interface" | "messages" | "alerts" | "activity";

export type SoundId =
  | "click"
  | "toggle"
  | "send"
  | "complete"
  | "cancel"
  | "error"
  | "notify"
  | "tool"
  | "memory"
  | "terminal"
  | "task";

export interface SoundDefinition {
  family: SoundFamily;
  /** Translation key for the settings list. */
  labelKey: string;
  tones: Tone[];
}

const tone = (
  frequency: number,
  at: number,
  duration: number,
  gain: number,
  wave: Waveform = "sine",
): Tone => ({ frequency, at, duration, gain, wave });

/**
 * The set.
 *
 * Shapes carry the meaning: rising for something sent, resolving upward for
 * something finished, falling for something stopped, low and doubled for
 * something wrong. None of them is longer than a third of a second.
 */
export const SOUNDS: Record<SoundId, SoundDefinition> = {
  // ------------------------------------------------------------- interface
  /** A press. The most frequent sound in the app, so the quietest and shortest. */
  click: {
    family: "interface",
    labelKey: "haptics.soundClick",
    tones: [tone(NOTE.C6, 0, 0.045, 0.22)],
  },
  /** A switch or tab changing. One step below a click in pitch, so they differ. */
  toggle: {
    family: "interface",
    labelKey: "haptics.soundToggle",
    tones: [tone(NOTE.G5, 0, 0.055, 0.26, "triangle")],
  },

  // -------------------------------------------------------------- messages
  /** A message leaves. Rising fourth: something is on its way. */
  send: {
    family: "messages",
    labelKey: "haptics.soundSend",
    tones: [tone(NOTE.D5, 0, 0.07, 0.3), tone(NOTE.A5, 0.05, 0.09, 0.28)],
  },
  /** An answer finished. A major triad, resolved upward — the "done" sound. */
  complete: {
    family: "messages",
    labelKey: "haptics.soundComplete",
    tones: [
      tone(NOTE.E5, 0, 0.1, 0.3),
      tone(NOTE.Gs5, 0.07, 0.11, 0.28),
      tone(NOTE.B5, 0.14, 0.16, 0.3),
    ],
  },
  /** Stopped on purpose. The same interval as `send`, falling. */
  cancel: {
    family: "messages",
    labelKey: "haptics.soundCancel",
    tones: [tone(NOTE.D5, 0, 0.07, 0.26), tone(NOTE.A4, 0.05, 0.11, 0.24)],
  },

  // ---------------------------------------------------------------- alerts
  /**
   * Something failed. Low and doubled rather than sharp: an error sound that
   * makes the user flinch gets the app muted, and then nothing is heard at all.
   */
  error: {
    family: "alerts",
    labelKey: "haptics.soundError",
    tones: [
      tone(NOTE.Ds4, 0, 0.1, 0.34, "triangle"),
      tone(NOTE.Ds4, 0.11, 0.14, 0.28, "triangle"),
    ],
  },
  /** Waiting on the user. The one sound allowed to ring a little longer. */
  notify: {
    family: "alerts",
    labelKey: "haptics.soundNotify",
    tones: [tone(NOTE.A5, 0, 0.12, 0.32), tone(NOTE.D6, 0.1, 0.2, 0.3)],
  },

  // -------------------------------------------------------------- activity
  /** A tool ran. Barely there — this can happen several times a minute. */
  tool: {
    family: "activity",
    labelKey: "haptics.soundTool",
    tones: [tone(NOTE.G6, 0, 0.03, 0.14)],
  },
  /** A fact reached the memory bank. High and brief, like a note being filed. */
  memory: {
    family: "activity",
    labelKey: "haptics.soundMemory",
    tones: [tone(NOTE.E6, 0, 0.05, 0.26), tone(NOTE.B6, 0.045, 0.07, 0.22)],
  },
  /** A shell is ready. Low, soft, physical. */
  terminal: {
    family: "activity",
    labelKey: "haptics.soundTerminal",
    tones: [tone(NOTE.G4, 0, 0.08, 0.26, "triangle")],
  },
  /** A todo ticked off. A small, bright step up. */
  task: {
    family: "activity",
    labelKey: "haptics.soundTask",
    tones: [tone(NOTE.G5, 0, 0.06, 0.26), tone(NOTE.C6, 0.055, 0.1, 0.26)],
  },
};

export const SOUND_IDS = Object.keys(SOUNDS) as SoundId[];

export const SOUND_FAMILIES: Array<{
  id: SoundFamily;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    id: "interface",
    labelKey: "haptics.familyInterface",
    descriptionKey: "haptics.familyInterfaceDesc",
  },
  {
    id: "messages",
    labelKey: "haptics.familyMessages",
    descriptionKey: "haptics.familyMessagesDesc",
  },
  {
    id: "alerts",
    labelKey: "haptics.familyAlerts",
    descriptionKey: "haptics.familyAlertsDesc",
  },
  {
    id: "activity",
    labelKey: "haptics.familyActivity",
    descriptionKey: "haptics.familyActivityDesc",
  },
];

/** How long the whole sound lasts, in seconds. */
export function soundDuration(id: SoundId): number {
  return SOUNDS[id].tones.reduce(
    (longest, item) => Math.max(longest, item.at + item.duration),
    0,
  );
}

/** Sounds in one family, in the order they are defined. */
export function soundsInFamily(family: SoundFamily): SoundId[] {
  return SOUND_IDS.filter((id) => SOUNDS[id].family === family);
}

/**
 * The longest a sound may last, and the loudest a single tone may peak.
 *
 * These are the definition of "small and soft" — a future sound that breaks
 * either one fails the unit test rather than surprising someone at midnight.
 */
export const MAX_SOUND_SECONDS = 0.35;
export const MAX_TONE_GAIN = 0.4;

/** Seconds of silence enforced between two plays of the same sound. */
export const REPEAT_GUARD_SECONDS = 0.05;

/**
 * Whether a sound may play again yet.
 *
 * Holding a key down, or a tool loop firing, would otherwise stack dozens of
 * copies into a buzz. Separated out so the rule is testable.
 */
export function canRepeat(lastPlayedAt: number | undefined, now: number): boolean {
  if (lastPlayedAt === undefined) return true;
  return now - lastPlayedAt >= REPEAT_GUARD_SECONDS * 1000;
}
