/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Readable } from 'node:stream';

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

interface RecorderModuleShape {
  default?: RecorderFactory;
  record?: RecorderFactory['record'];
}

export interface MicrophoneCapture {
  stream: Readable;
  stop: () => void;
}

function isRecorderFactory(value: unknown): value is RecorderFactory {
  return (
    typeof value === 'object' &&
    value !== null &&
    'record' in value &&
    typeof (value as { record?: unknown }).record === 'function'
  );
}

function isRecorderModuleShape(value: unknown): value is RecorderModuleShape {
  return typeof value === 'object' && value !== null;
}

function getRecorderFactory(moduleShape: RecorderModuleShape): RecorderFactory {
  const candidate = moduleShape.default ?? moduleShape;
  if (!isRecorderFactory(candidate)) {
    throw new Error('node-record-lpcm16 did not expose a valid recorder API.');
  }
  return candidate;
}

/**
 * Starts local microphone capture as 16kHz mono PCM suitable for Gemini Live.
 */
export async function startMicrophone(): Promise<MicrophoneCapture> {
  let moduleShape: unknown;
  try {
    moduleShape = await import('node-record-lpcm16');
  } catch {
    throw new Error(
      'Voice mode microphone capture requires node-record-lpcm16. Install it in the CLI workspace to enable native audio input.',
    );
  }

  if (!isRecorderModuleShape(moduleShape)) {
    throw new Error('node-record-lpcm16 did not return a valid module.');
  }

  const recorder = getRecorderFactory(moduleShape);
  const recording = recorder.record({
    sampleRate: 16000,
    channels: 1,
    audioType: 'raw',
    threshold: 0,
  });

  return {
    stream: recording.stream(),
    stop: () => recording.stop(),
  };
}
