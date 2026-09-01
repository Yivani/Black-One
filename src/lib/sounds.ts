import { convertFileSrc } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/ipc";
import {
  canRepeat,
  SOUNDS,
  soundDuration,
  type SoundId,
  type Tone,
} from "@/lib/soundCore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { HapticSettings } from "@/types/settings";

/**
 * The audio engine.
 *
 * One `AudioContext`, created on the first sound and reused forever — building
 * one per sound leaks hardware voices and eventually stops making noise at all.
 * Everything runs through a shared low-pass so no sound has a hard edge on it.
 */

let context: AudioContext | null = null;
let master: GainNode | null = null;
let softener: BiquadFilterNode | null = null;

/** Last time each sound was played, for the repeat guard. */
const lastPlayed = new Map<SoundId, number>();

/** Cuts the fizz off the top of a square-ish attack. */
const SOFTEN_HZ = 5200;

function audio(): { context: AudioContext; destination: AudioNode } | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      context = new Ctor();
    } catch {
      return null;
    }
    master = context.createGain();
    master.gain.value = 1;
    softener = context.createBiquadFilter();
    softener.type = "lowpass";
    softener.frequency.value = SOFTEN_HZ;
    softener.Q.value = 0.7;
    softener.connect(master);
    master.connect(context.destination);
  }
  // Browsers start the context suspended until a gesture; every one of our
  // sounds follows a gesture, so this resumes on the first one.
  if (context.state === "suspended") void context.resume().catch(() => {});
  return { context, destination: softener! };
}

/**
 * Schedules one tone.
 *
 * The 6 ms attack matters more than it looks: starting a gain at full value
 * puts a step in the waveform, which is heard as a click on top of the note.
 */
function scheduleTone(
  ctx: AudioContext,
  destination: AudioNode,
  item: Tone,
  startAt: number,
  volume: number,
): void {
  const oscillator = ctx.createOscillator();
  oscillator.type = item.wave;
  oscillator.frequency.value = item.frequency;

  const envelope = ctx.createGain();
  const peak = Math.max(0.0001, item.gain * volume);
  const begin = startAt + item.at;
  const attack = Math.min(0.006, item.duration / 3);

  envelope.gain.setValueAtTime(0.0001, begin);
  envelope.gain.linearRampToValueAtTime(peak, begin + attack);
  // Exponential decay is what makes a tone sound struck rather than switched
  // off; it can never reach zero, hence the tiny floor.
  envelope.gain.exponentialRampToValueAtTime(0.0001, begin + item.duration);

  oscillator.connect(envelope);
  envelope.connect(destination);
  oscillator.start(begin);
  oscillator.stop(begin + item.duration + 0.02);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
}

/** A file the user chose instead of a built-in sound, if any. */
function customFile(id: SoundId, haptics: HapticSettings): string | null {
  const chosen =
    id === "click" ? haptics.clickSound
    : id === "complete" ? haptics.finishSound
    : id === "error" ? haptics.errorSound
    : "default";
  if (!chosen || chosen === "default") return null;
  if (!isTauri) return null;
  try {
    return convertFileSrc(chosen);
  } catch {
    return null;
  }
}

function playFile(url: string, volume: number): void {
  const element = new Audio(url);
  element.volume = Math.max(0, Math.min(1, volume));
  void element.play().catch(() => {
    // Autoplay policy, a missing file, an unsupported codec: all silent.
  });
}

/** Whether the family this sound belongs to is switched on. */
function familyEnabled(id: SoundId, haptics: HapticSettings): boolean {
  switch (SOUNDS[id].family) {
    case "interface":
      return haptics.interfaceSounds;
    case "messages":
      return haptics.messageSounds;
    case "alerts":
      return haptics.alertSounds;
    case "activity":
      return haptics.activitySounds;
  }
}

/**
 * Plays one of the app's sounds, if the user wants to hear it.
 *
 * Safe to call from anywhere and on any event: it is silent when haptics are
 * off, when the family is off, when the same sound just played, and when the
 * platform has no audio at all.
 */
export function playAppSound(id: SoundId): void {
  const { haptics } = useSettingsStore.getState().settings;
  if (!haptics.enabled) return;
  if (!familyEnabled(id, haptics)) return;
  previewAppSound(id);
}

/**
 * Plays a sound regardless of its family switch.
 *
 * The settings page needs this: pressing "play" next to a sound that is
 * currently switched off should still let you hear what you are switching on.
 */
export function previewAppSound(id: SoundId): void {
  const { haptics } = useSettingsStore.getState().settings;
  const volume = Math.max(0, Math.min(1, haptics.volume));
  if (volume === 0) return;

  const now = Date.now();
  if (!canRepeat(lastPlayed.get(id), now)) return;
  lastPlayed.set(id, now);

  const file = customFile(id, haptics);
  if (file) {
    playFile(file, volume);
    return;
  }

  const engine = audio();
  if (!engine) return;
  const startAt = engine.context.currentTime + 0.001;
  for (const item of SOUNDS[id].tones) {
    scheduleTone(engine.context, engine.destination, item, startAt, volume);
  }
}

/** How long the given sound rings, for a UI that wants to wait it out. */
export function appSoundDuration(id: SoundId): number {
  return soundDuration(id);
}

/**
 * Releases the audio device.
 *
 * Called when sound is switched off so a muted app is not holding an open
 * output — on some machines that alone keeps a dedicated sound card awake.
 */
export function releaseAudio(): void {
  if (!context) return;
  void context.close().catch(() => {});
  context = null;
  master = null;
  softener = null;
  lastPlayed.clear();
}
