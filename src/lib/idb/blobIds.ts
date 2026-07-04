import type { BlobId } from './index';

/**
 * Namespaced BlobId helpers (D-05).
 *
 * Callers pass a UUID (`crypto.randomUUID()`) and receive a value typed both as
 * the general `BlobId` template-literal union AND as the more specific
 * `room:${string}` / `lib:${string}` sub-brand — so downstream code that only
 * accepts room blobs can narrow the parameter without runtime checks.
 */

export function roomBlobId(uuid: string): BlobId & `room:${string}` {
  return `room:${uuid}` as BlobId & `room:${string}`;
}

export function libBlobId(uuid: string): BlobId & `lib:${string}` {
  return `lib:${uuid}` as BlobId & `lib:${string}`;
}
