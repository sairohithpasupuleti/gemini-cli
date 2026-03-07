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

  constructor(
    private readonly ai: GoogleGenAI = new GoogleGenAI({}),
    private readonly model: string = DEFAULT_LIVE_MODEL,
  ) {}

  async connect(callbacks: VoiceAudioCallbacks): Promise<void> {
    this.session = await this.ai.live.connect({
      model: this.model,
      config: {
        responseModalities: [Modality.TEXT],
      },
      callbacks: {
        onmessage: (message) => {
          const transcript = extractTranscript(message);
          if (transcript) {
            callbacks.onTranscript(transcript);
          }
        },
        onerror: (event) => {
          const err =
            event.error instanceof Error
              ? event.error
              : new Error('Gemini live audio session error');
          callbacks.onError(err);
        },
      },
    });
  }

  sendAudioChunk(chunk: Buffer): void {
    this.session?.sendRealtimeInput({
      audio: createAudioBlob(chunk),
    });
  }

  endAudioInput(): void {
    this.session?.sendRealtimeInput({ audioStreamEnd: true });
  }

  close(): void {
    this.session?.close();
    this.session = undefined;
  }
}
