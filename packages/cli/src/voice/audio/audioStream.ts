/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Blob } from '@google/genai';

const AUDIO_MIME_TYPE = 'audio/pcm;rate=16000';

/**
 * Converts raw PCM chunks into the blob payload accepted by Gemini Live API.
 */
export function createAudioBlob(chunk: Buffer): Blob {
  return {
    data: chunk.toString('base64'),
    mimeType: AUDIO_MIME_TYPE,
  };
}
