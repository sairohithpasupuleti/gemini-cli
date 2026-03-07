/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

declare module 'node-record-lpcm16' {
  import type { Readable } from 'node:stream';

  export interface RecorderInstance {
    stream: () => Readable;
    stop: () => void;
  }

  export interface RecorderOptions {
    sampleRate: number;
    channels: number;
    audioType: 'wav';
    threshold: number;
  }

  export const record: (options: RecorderOptions) => RecorderInstance;
}
