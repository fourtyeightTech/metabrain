import type { SurfaceFrameSummary } from './types';

export const SURFACE_FRAME_MAGIC = 'MTRYSF01';
export const SURFACE_FRAME_HEADER_BYTES = 32;
export const SURFACE_FRAME_MIME = 'application/vnd.metatray.surface-frames';
const MAX_FRAME_COUNT = 512;
const MAX_VERTEX_COUNT = 20_484;
const MAX_DECODED_BYTES = 64 * 1024 * 1024;
const FIXED_COLOR_LIMIT = 2;

export interface DecodedSurfaceFrames {
  version: 1;
  vertexCount: number;
  frameCount: number;
  colorLimit: number;
  starts: Float32Array;
  durations: Float32Array;
  quantized: Int16Array;
  frame(index: number, target?: Float32Array): Float32Array;
}

function checkedProduct(a: number, b: number) {
  const product = a * b;
  if (!Number.isSafeInteger(product) || product <= 0) throw new Error('Invalid surface frame dimensions');
  return product;
}

/** Parse the uncompressed body returned by the surface endpoint.
 * Browsers transparently decode the endpoint's HTTP Content-Encoding: gzip.
 */
export function decodeSurfaceFrames(input: ArrayBuffer | ArrayBufferView, expected?: SurfaceFrameSummary): DecodedSurfaceFrames {
  const bytes = input instanceof ArrayBuffer
    ? new Uint8Array(input)
    : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (bytes.byteLength < SURFACE_FRAME_HEADER_BYTES) throw new Error('Surface frame payload is truncated');
  const magic = new TextDecoder().decode(bytes.subarray(0, 8));
  if (magic !== SURFACE_FRAME_MAGIC) throw new Error('Unsupported surface frame payload');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint16(8, true);
  const flags = view.getUint16(10, true);
  const headerBytes = view.getUint32(12, true);
  const vertexCount = view.getUint32(16, true);
  const frameCount = view.getUint32(20, true);
  const colorLimit = view.getFloat32(24, true);
  if (version !== 1 || flags !== 1 || headerBytes !== SURFACE_FRAME_HEADER_BYTES ||
      !Number.isFinite(colorLimit) || Math.abs(colorLimit - FIXED_COLOR_LIMIT) > 1e-6)
    throw new Error('Unsupported surface frame header');
  if (!frameCount || frameCount > MAX_FRAME_COUNT || !vertexCount || vertexCount > MAX_VERTEX_COUNT || bytes.byteLength > MAX_DECODED_BYTES)
    throw new Error('Surface frame dimensions exceed the browser safety limit');
  const sampleCount = checkedProduct(vertexCount, frameCount);
  const expectedBytes = headerBytes + frameCount * 8 + sampleCount * 2;
  if (bytes.byteLength !== expectedBytes) throw new Error('Surface frame payload length does not match its header');
  if (expected && (expected.version !== version || expected.format !== 'metatray-surface-int16-le' || expected.compression !== 'gzip'
      || expected.quantization !== 'signed-int16-fixed-symmetric' || expected.timing !== 'upstream-segment-start-duration-seconds'
      || expected.vertexCount !== vertexCount || expected.frameCount !== frameCount || Math.abs(expected.colorLimit - colorLimit) > 1e-6
      || !Number.isInteger(expected.byteLength) || expected.byteLength <= 0 || expected.byteLength > 16 * 1024 * 1024
      || !/^[0-9a-f]{64}$/.test(expected.sha256))) throw new Error('Surface frame metadata does not match its payload');
  const starts = new Float32Array(frameCount); const durations = new Float32Array(frameCount);
  let offset = headerBytes;
  for (let i = 0; i < frameCount; i++, offset += 4) starts[i] = view.getFloat32(offset, true);
  for (let i = 0; i < frameCount; i++, offset += 4) durations[i] = view.getFloat32(offset, true);
  for (let i = 0; i < frameCount; i++) {
    if (!Number.isFinite(starts[i]) || !Number.isFinite(durations[i]) || durations[i] <= 0 || (i && starts[i] <= starts[i - 1]))
      throw new Error('Surface frame timing is invalid');
  }
  const quantized = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++, offset += 2) {
    const value = view.getInt16(offset, true);
    if (value === -32768) throw new Error('Surface frame contains a reserved value');
    quantized[i] = value;
  }
  return { version: 1, vertexCount, frameCount, colorLimit, starts, durations, quantized,
    frame(index, target = new Float32Array(vertexCount)) {
      if (!Number.isInteger(index) || index < 0 || index >= frameCount) throw new RangeError('Surface frame index is out of bounds');
      if (target.length !== vertexCount) throw new Error('Surface frame target length is invalid');
      const start = index * vertexCount; const scale = colorLimit / 32767;
      for (let i = 0; i < vertexCount; i++) target[i] = quantized[start + i] * scale;
      return target;
    } };
}
