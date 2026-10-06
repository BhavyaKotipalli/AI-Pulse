import type { ListenHandlers, VoiceProvider } from "./provider";

// Minimal typings for the Web Speech API (not in lib.dom for all targets).
interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in your browser's site settings.",
  "service-not-allowed": "Speech recognition is not allowed in this browser.",
  "no-speech": "I didn't hear anything. Try again.",
  "audio-capture": "No microphone was found.",
  network: "Speech recognition needs a network connection in this browser.",
};

/** Free, built-in voice: Web Speech API for recognition and speechSynthesis for output. */
export function createBrowserVoice(): VoiceProvider {
  const Ctor = recognitionCtor();
  const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : undefined;

  return {
    id: "browser",
    canListen: Boolean(Ctor),
    canSpeak: Boolean(synth),

    listen(handlers: ListenHandlers) {
      if (!Ctor) {
        handlers.onError("Voice input is not supported in this browser. Try Chrome or Edge.");
        handlers.onEnd();
        return () => {};
      }
      const rec = new Ctor();
      rec.lang = navigator.language || "en-US";
      rec.interimResults = true;
      rec.continuous = false;
      let finalText = "";
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          const transcript = result?.[0]?.transcript ?? "";
          if (result?.isFinal) finalText += transcript;
          else interim += transcript;
        }
        if (interim) handlers.onInterim((finalText + interim).trim());
      };
      rec.onerror = (e) => {
        if (e.error !== "aborted") handlers.onError(ERRORS[e.error] ?? `Voice input failed (${e.error}).`);
      };
      rec.onend = () => {
        if (finalText.trim()) handlers.onFinal(finalText.trim());
        handlers.onEnd();
      };
      try {
        rec.start();
      } catch {
        handlers.onError("Voice input could not start.");
        handlers.onEnd();
      }
      return () => rec.abort();
    },

    speak(text, handlers) {
      if (!synth || !text.trim()) {
        handlers?.onEnd?.();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = navigator.language || "en-US";
      utterance.rate = 1.05;
      utterance.onstart = () => handlers?.onStart?.();
      utterance.onend = () => handlers?.onEnd?.();
      utterance.onerror = () => handlers?.onEnd?.();
      synth.speak(utterance);
    },

    cancel() {
      synth?.cancel();
    },
  };
}
