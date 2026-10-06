/**
 * Voice provider abstraction. The app talks to this interface only, so the browser
 * implementation can be replaced by a hosted STT/TTS service (OpenAI, ElevenLabs,
 * Deepgram…) without touching UI code.
 */
export interface ListenHandlers {
  onInterim(text: string): void;
  onFinal(text: string): void;
  onError(message: string): void;
  onEnd(): void;
}

export interface VoiceProvider {
  readonly id: string;
  readonly canListen: boolean;
  readonly canSpeak: boolean;
  /** Starts one utterance of speech recognition. Returns a function that aborts it. */
  listen(handlers: ListenHandlers): () => void;
  /** Queues text to be spoken after anything already queued. */
  speak(text: string, handlers?: { onStart?: () => void; onEnd?: () => void }): void;
  /** Stops speaking immediately and clears the queue (used for barge-in). */
  cancel(): void;
}

/** Converts streamed markdown into speakable text: no citation markers, emphasis marks or bullets. */
export function toSpeakable(markdown: string): string {
  return markdown
    .replace(/\[\d{1,2}\]/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|\s)_([^_]+)_(?=\s|$|[.,;:!?])/g, "$1$2")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Splits a growing text buffer into complete sentences plus the unfinished remainder,
 * so speech can start while the answer is still streaming.
 */
export function takeSentences(buffer: string): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  let rest = buffer;
  for (;;) {
    const match = rest.match(/^([\s\S]*?[.!?])(\s+|\n+)(?=\S)/) ?? rest.match(/^([\s\S]*?)\n{2,}/);
    if (!match || match[1] === undefined) break;
    const sentence = match[1].trim();
    if (sentence) sentences.push(sentence);
    rest = rest.slice(match[0].length);
  }
  return { sentences, rest };
}
