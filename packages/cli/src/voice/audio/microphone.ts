/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Readable } from 'node:stream';
import * as recorder from 'node-record-lpcm16';

interface RecorderInstance {
  stream: () => Readable;
  stop: () => void;
}

interface RecorderFactory {
  record: (options: {
    sampleRate: number;
    channels: number;
    audioType: 'wav' | 'raw';
    threshold: number;
  }) => RecorderInstance;
}

export interface MicrophoneCapture {
  stream: Readable;
  stop: () => void;
}

const VOICE_DEBUG_ENABLED = process.env['GEMINI_VOICE_DEBUG'] === 'true';

function debugLog(message: string): void {
  if (!VOICE_DEBUG_ENABLED) {
    return;
  }
  process.stdout.write(`[voice:debug] ${message}\n`);
}

function isRecorderFactory(value: unknown): value is RecorderFactory {
  return (
    typeof value === 'object' &&
    value !== null &&
    'record' in value &&
    typeof (value as { record?: unknown }).record === 'function'
  );
}

function getRecorderFactory(factoryLike: unknown): RecorderFactory {
  if (isRecorderFactory(factoryLike)) {
    return factoryLike;
  }

  if (
    typeof factoryLike === 'object' &&
    factoryLike !== null &&
    'default' in factoryLike
  ) {
    const defaultExport = (factoryLike as { default?: unknown }).default;
    if (isRecorderFactory(defaultExport)) {
      return defaultExport;
    }
  }

  throw new Error('node-record-lpcm16 did not expose a valid recorder API.');
}

/**
 * Starts local microphone capture as 16kHz mono PCM suitable for Gemini Live.
 */
export function startMicrophone(): MicrophoneCapture {
  debugLog('starting microphone capture');
  const recorderFactory = getRecorderFactory(recorder);
  const recording = recorderFactory.record({
    sampleRate: 16000,
    channels: 1,
    audioType: 'raw',
    threshold: 0,
  });
  const stream = recording.stream();
  let sawChunk = false;

  stream.on('data', () => {
    if (sawChunk) {
      return;
    }
    sawChunk = true;
    debugLog('microphone audio chunk received');
  });
  stream.on('error', (err: Error) => {
    debugLog(`microphone error: ${err.message}`);
  });
  debugLog('microphone stream created');

  return {
    stream,
    stop: () => recording.stop(),
  };
}
