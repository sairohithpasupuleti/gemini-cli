/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GoogleGenAI,
  Modality,
  type LiveServerMessage,
  type Session,
} from '@google/genai';
import { createAudioBlob } from '../audio/audioStream.js';

const DEFAULT_LIVE_MODEL = 'gemini-live-2.5-flash-preview';
const VOICE_DEBUG_ENABLED = process.env['GEMINI_VOICE_DEBUG'] === 'true';

export interface VoiceAudioCallbacks {
  onTranscript: (text: string) => void;
  onError: (error: Error) => void;
}

export interface VoiceAudioClient {
  connect: (callbacks: VoiceAudioCallbacks) => Promise<void>;
  sendAudioChunk: (chunk: Buffer) => void;
  endAudioInput: () => void;
  close: () => void;
}

function extractTranscript(message: LiveServerMessage): string | null {
  const transcription = message.serverContent?.inputTranscription?.text?.trim();
  if (transcription) {
    return transcription;
  }

  const modelText = message.serverContent?.modelTurn?.parts
    ?.map((part) =>
      'text' in part && typeof part.text === 'string' ? part.text : '',
    )
    .join('')
    .trim();

  return modelText || null;
}

export class GeminiAudioClient implements VoiceAudioClient {
  private session: Session | undefined;
  private connected = false;

  constructor(
    private readonly ai: GoogleGenAI = new GoogleGenAI({}),
    private readonly model: string = DEFAULT_LIVE_MODEL,
  ) {}

  async connect(callbacks: VoiceAudioCallbacks): Promise<void> {
    this.session = await this.ai.live.connect({
      model: this.model,
      config: {
        responseModalities: [Modality.TEXT],
        inputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          this.connected = true;
          if (VOICE_DEBUG_ENABLED) {
            process.stdout.write(
              '[voice:debug] Gemini Live websocket opened\n',
            );
          }
        },
        onmessage: (message) => {
          if (VOICE_DEBUG_ENABLED) {
            const hasInputTranscript = Boolean(
              message.serverContent?.inputTranscription?.text,
            );
            const hasOutputTranscript = Boolean(
              message.serverContent?.outputTranscription?.text,
            );
            const hasModelTurn = Boolean(message.serverContent?.modelTurn);
            process.stdout.write(
              `[voice:debug] Gemini Live message received (inputTranscript=${hasInputTranscript}, outputTranscript=${hasOutputTranscript}, modelTurn=${hasModelTurn})\n`,
            );
          }
          const transcript = extractTranscript(message);
          if (transcript) {
            callbacks.onTranscript(transcript);
          } else if (VOICE_DEBUG_ENABLED) {
            process.stdout.write(
              '[voice:debug] Gemini Live message had no transcript text\n',
            );
          }
        },
        onerror: (event) => {
          this.connected = false;
          const err =
            event.error instanceof Error
              ? event.error
              : new Error('Gemini live audio session error');
          callbacks.onError(err);
        },
        onclose: (event) => {
          this.connected = false;
          if (VOICE_DEBUG_ENABLED) {
            process.stdout.write(
              `[voice:debug] Gemini Live websocket closed (code=${event.code}, reason="${event.reason}")\n`,
            );
          }
          callbacks.onError(
            new Error(
              `Gemini Live connection closed (code=${event.code}, reason="${event.reason || 'none'}")`,
            ),
          );
        },
      },
    });
  }

  sendAudioChunk(chunk: Buffer): void {
    if (!this.connected || !this.session) {
      return;
    }
    this.session?.sendRealtimeInput({
      audio: createAudioBlob(chunk),
    });
  }

  endAudioInput(): void {
    if (!this.connected || !this.session) {
      return;
    }
    this.session?.sendRealtimeInput({ audioStreamEnd: true });
  }

  close(): void {
    this.connected = false;
    this.session?.close();
    this.session = undefined;
  }
}
