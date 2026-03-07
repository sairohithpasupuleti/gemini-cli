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
import { GoogleGenAI } from '@google/genai';

type Awaitable<T> = T | Promise<T>;

const VOICE_MODE_HELP_TEXT =
  'Voice Mode Commands:\n\n' +
  'install dependencies -> npm install\n' +
  'build project -> npm run build\n' +
  'run checks -> npm run preflight\n' +
  'exit -> leave voice mode\n';
const VOICE_DEBUG_ENABLED = process.env['GEMINI_VOICE_DEBUG'] === 'true';

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
  private sawAudioChunk = false;

  constructor(
    private readonly config: Config,
    private readonly settings: LoadedSettings,
    options: VoiceSessionOptions = {},
  ) {
    this.output = options.output ?? process.stdout;
    this.createPromptId = options.createPromptId ?? (() => randomUUID());
    this.createMicrophone = options.createMicrophone ?? startMicrophone;
    this.createGeminiAudioClient =
      options.createGeminiAudioClient ??
      (() => {
        const apiKey =
          process.env['GOOGLE_API_KEY'] ?? process.env['GEMINI_API_KEY'];
        const apiVersion = process.env['GEMINI_VOICE_API_VERSION'] || 'v1beta';
        const model = process.env['GEMINI_VOICE_MODEL'];
        const ai = new GoogleGenAI({ apiKey, apiVersion });
        return model
          ? new GeminiAudioClient(ai, model)
          : new GeminiAudioClient(ai);
      });
  }

  async start(): Promise<void> {
    this.output.write('Initializing microphone...\n');
    this.debug('voice session start requested');
    const microphone = await this.createMicrophone();
    this.output.write('Microphone ready.\n');
    this.debug('microphone capture initialized');
    const geminiAudioClient = this.createGeminiAudioClient();
    this.output.write('Listening for voice input...\n');
    this.debug('connecting to Gemini Live API');

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
      this.debug('finishing voice session');
      microphone.stop();
      geminiAudioClient.endAudioInput();
      geminiAudioClient.close();
      void this.pendingTranscript.finally(() => {
        resolveDone?.();
      });
    };

    await geminiAudioClient.connect({
      onTranscript: (text) => {
        this.debug(`transcript callback received: "${text.trim()}"`);
        this.pendingTranscript = this.pendingTranscript
          .then(() => this.handleTranscript(text, finish))
          .catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : String(error);
            this.output.write(`Voice mode error: ${message}\n`);
          });
      },
      onError: (error) => {
        this.debug(`Gemini Live error: ${error.message}`);
        this.output.write(`Voice mode error: ${error.message}\n`);
        finish();
      },
    });
    this.debug('Gemini Live connected');

    microphone.stream.on('data', (chunk: Buffer | Uint8Array) => {
      if (!this.sawAudioChunk) {
        this.sawAudioChunk = true;
        this.debug('first audio chunk captured and sent to Gemini Live');
      }
      if (Buffer.isBuffer(chunk)) {
        geminiAudioClient.sendAudioChunk(chunk);
      } else {
        geminiAudioClient.sendAudioChunk(Buffer.from(chunk));
      }
    });
    microphone.stream.on('error', (error: Error) => {
      this.debug(`microphone stream error: ${error.message}`);
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
      this.debug('ignored empty transcript');
      return;
    }

    this.output.write(`Heard: ${trimmed}\n`);

    const normalized = trimmed.toLowerCase();
    if (
      normalized.includes('help') ||
      normalized.includes('what can i say') ||
      normalized.includes('commands')
    ) {
      this.debug('matched voice help request');
      this.output.write(VOICE_MODE_HELP_TEXT);
      return;
    }

    if (normalized === 'exit') {
      this.debug('matched voice exit request');
      this.output.write('Exiting voice mode.\n');
      finish();
      return;
    }

    const command = parseVoiceIntent(trimmed);
    if (command) {
      this.debug(`mapped transcript to command: ${command}`);
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
      this.debug(`suggested command: ${suggestion}`);
      this.output.write(`Did you mean: ${suggestion} ?\n`);
    } else {
      this.debug('transcript not recognized');
      this.output.write('Voice command not recognized.\n');
    }
  }

  private debug(message: string): void {
    if (!VOICE_DEBUG_ENABLED) {
      return;
    }
    this.output.write(`[voice:debug] ${message}\n`);
  }
}
