/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '@google/gemini-cli-core';
import type { LoadedSettings } from '../config/settings.js';
import { runNonInteractive } from '../nonInteractiveCli.js';
import { randomUUID } from 'node:crypto';
import type { Writable } from 'node:stream';
import { startMicrophone, type MicrophoneCapture } from './audio/microphone.js';
import {
  GeminiAudioClient,
  type VoiceAudioClient,
} from './gemini/geminiAudioClient.js';
import { parseVoiceIntent, suggestVoiceIntent } from './voiceIntentParser.js';

type Awaitable<T> = T | Promise<T>;

const VOICE_MODE_HELP_TEXT =
  'Voice Mode Commands:\n\n' +
  'install dependencies -> npm install\n' +
  'build project -> npm run build\n' +
  'run checks -> npm run preflight\n' +
  'exit -> leave voice mode\n';

interface VoiceSessionOptions {
  output?: Writable;
  createPromptId?: () => string;
  createMicrophone?: () => Awaitable<MicrophoneCapture>;
  createGeminiAudioClient?: () => VoiceAudioClient;
}

export class VoiceSession {
  private readonly output: Writable;
  private readonly createPromptId: () => string;
  private readonly createMicrophone: () => Awaitable<MicrophoneCapture>;
  private readonly createGeminiAudioClient: () => VoiceAudioClient;
  private pendingTranscript = Promise.resolve();

  constructor(
    private readonly config: Config,
    private readonly settings: LoadedSettings,
    options: VoiceSessionOptions = {},
  ) {
    this.output = options.output ?? process.stdout;
    this.createPromptId = options.createPromptId ?? (() => randomUUID());
    this.createMicrophone = options.createMicrophone ?? startMicrophone;
    this.createGeminiAudioClient =
      options.createGeminiAudioClient ?? (() => new GeminiAudioClient());
  }

  async start(): Promise<void> {
    const microphone = await this.createMicrophone();
    const geminiAudioClient = this.createGeminiAudioClient();
    this.output.write('Listening for voice input...\n');

    let finished = false;
    let resolveDone: (() => void) | undefined;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });

    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      microphone.stop();
      geminiAudioClient.endAudioInput();
      geminiAudioClient.close();
      void this.pendingTranscript.finally(() => {
        resolveDone?.();
      });
    };

    await geminiAudioClient.connect({
      onTranscript: (text) => {
        this.pendingTranscript = this.pendingTranscript
          .then(() => this.handleTranscript(text, finish))
          .catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : String(error);
            this.output.write(`Voice mode error: ${message}\n`);
          });
      },
      onError: (error) => {
        this.output.write(`Voice mode error: ${error.message}\n`);
        finish();
      },
    });

    microphone.stream.on('data', (chunk: Buffer | Uint8Array) => {
      if (Buffer.isBuffer(chunk)) {
        geminiAudioClient.sendAudioChunk(chunk);
      } else {
        geminiAudioClient.sendAudioChunk(Buffer.from(chunk));
      }
    });
    microphone.stream.on('error', (error: Error) => {
      this.output.write(`Microphone error: ${error.message}\n`);
      finish();
    });
    microphone.stream.on('close', finish);
    microphone.stream.on('end', finish);

    await done;
  }

  private async handleTranscript(
    transcript: string,
    finish: () => void,
  ): Promise<void> {
    const trimmed = transcript.trim();
    if (!trimmed) {
      return;
    }

    this.output.write(`Heard: ${trimmed}\n`);

    const normalized = trimmed.toLowerCase();
    if (
      normalized.includes('help') ||
      normalized.includes('what can i say') ||
      normalized.includes('commands')
    ) {
      this.output.write(VOICE_MODE_HELP_TEXT);
      return;
    }

    if (normalized === 'exit') {
      this.output.write('Exiting voice mode.\n');
      finish();
      return;
    }

    const command = parseVoiceIntent(trimmed);
    if (command) {
      await runNonInteractive({
        config: this.config,
        settings: this.settings,
        input: command,
        prompt_id: this.createPromptId(),
      });
      return;
    }

    const suggestion = suggestVoiceIntent(trimmed);
    if (suggestion) {
      this.output.write(`Did you mean: ${suggestion} ?\n`);
    } else {
      this.output.write('Voice command not recognized.\n');
    }
  }
}
