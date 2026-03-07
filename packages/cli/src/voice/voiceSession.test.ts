/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, vi, expect, beforeEach } from 'vitest';

// Mock dependencies before they are imported
const mockRunNonInteractive = vi.hoisted(() => vi.fn());
vi.mock('../nonInteractiveCli.js', () => ({
  runNonInteractive: mockRunNonInteractive,
}));

import { VoiceSession } from './voiceSession.js';
import { PassThrough } from 'node:stream';
import type { MicrophoneCapture } from './audio/microphone.js';
import type {
  VoiceAudioCallbacks,
  VoiceAudioClient,
} from './gemini/geminiAudioClient.js';

class FakeGeminiAudioClient implements VoiceAudioClient {
  callbacks: VoiceAudioCallbacks | undefined;
  readonly chunks: Buffer[] = [];
  closed = false;
  ended = false;

  async connect(callbacks: VoiceAudioCallbacks): Promise<void> {
    this.callbacks = callbacks;
  }

  sendAudioChunk(chunk: Buffer): void {
    this.chunks.push(chunk);
  }

  endAudioInput(): void {
    this.ended = true;
  }

  close(): void {
    this.closed = true;
  }

  emitTranscript(text: string): void {
    this.callbacks?.onTranscript(text);
  }
}

describe('VoiceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createHarness() {
    const output = new PassThrough();
    const microphoneStream = new PassThrough();
    const fakeClient = new FakeGeminiAudioClient();
    let printed = '';
    output.on('data', (chunk: Buffer | string) => {
      printed += chunk.toString();
    });

    const micStop = vi.fn();
    const mic: MicrophoneCapture = {
      stream: microphoneStream,
      stop: micStop,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const voiceSession = new VoiceSession({} as any, {} as any, {
      output,
      createMicrophone: () => mic,
      createGeminiAudioClient: () => fakeClient,
      createPromptId: () => 'test-id',
    });

    return {
      voiceSession,
      fakeClient,
      microphoneStream,
      getPrinted: () => printed,
      micStop,
    };
  }

  it('should stream audio and execute recognized command from transcript', async () => {
    const harness = createHarness();
    const startPromise = harness.voiceSession.start();
    await Promise.resolve();

    harness.microphoneStream.write(Buffer.from('audio-chunk-1'));
    harness.fakeClient.emitTranscript('install dependencies');
    harness.fakeClient.emitTranscript('exit');
    harness.microphoneStream.end();

    await startPromise;

    expect(mockRunNonInteractive).toHaveBeenCalledTimes(1);
    expect(mockRunNonInteractive).toHaveBeenCalledWith(
      expect.objectContaining({
        input: 'npm install',
        prompt_id: 'test-id',
      }),
    );
  });

  it('should print help text when transcript asks for help', async () => {
    const harness = createHarness();
    const startPromise = harness.voiceSession.start();
    await Promise.resolve();

    harness.fakeClient.emitTranscript('what can i say');
    harness.fakeClient.emitTranscript('exit');
    harness.microphoneStream.end();

    await startPromise;

    expect(mockRunNonInteractive).not.toHaveBeenCalled();
    expect(harness.getPrinted()).toContain('Voice Mode Commands:');
    expect(harness.getPrinted()).toContain('build project -> npm run build');
  });

  it('should suggest command for partially matched transcript', async () => {
    const harness = createHarness();
    const startPromise = harness.voiceSession.start();
    await Promise.resolve();

    harness.fakeClient.emitTranscript('install dep');
    harness.fakeClient.emitTranscript('exit');
    harness.microphoneStream.end();

    await startPromise;

    expect(mockRunNonInteractive).not.toHaveBeenCalled();
    expect(harness.getPrinted()).toContain('Did you mean: npm install ?');
  });

  it('should print unknown message when transcript is unrecognized', async () => {
    const harness = createHarness();
    const startPromise = harness.voiceSession.start();
    await Promise.resolve();

    harness.fakeClient.emitTranscript('say hello to world');
    harness.fakeClient.emitTranscript('exit');
    harness.microphoneStream.end();

    await startPromise;

    expect(mockRunNonInteractive).not.toHaveBeenCalled();
    expect(harness.getPrinted()).toContain('Voice command not recognized.');
  });

  it('should stop microphone and close client when exiting', async () => {
    const harness = createHarness();
    const startPromise = harness.voiceSession.start();
    await Promise.resolve();

    harness.fakeClient.emitTranscript('exit');
    harness.microphoneStream.end();

    await startPromise;

    expect(harness.micStop).toHaveBeenCalled();
    expect(harness.fakeClient.closed).toBe(true);
    expect(harness.fakeClient.ended).toBe(true);
    expect(harness.getPrinted()).toContain('Exiting voice mode.');
  });
});
