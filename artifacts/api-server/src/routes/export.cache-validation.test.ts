/**
 * Unit/integration tests for the MP4 cache-validation helper and the startup
 * disk-cache loader in the export route (task 122).
 *
 * Scenario being guarded: if the server crashes mid-write the cache file on
 * disk may be empty, truncated before the ftyp header was flushed, or contain
 * only the ftyp box with no moov/media data.  loadDiskCache() must skip every
 * such file and leave renderCache null rather than serving broken video.
 *
 * No vi.mock() calls here — these tests use real fs operations so the
 * loadDiskCache integration cases can write and read actual temp files.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  isValidMp4Buffer,
  loadDiskCache,
  computePromoSourceHash,
  getRenderCacheForTest,
  resetRenderCacheForTest,
} from "./export.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a buffer that looks like a plausible (but tiny) MP4.
 *
 * Layout:
 *   ftyp box  — [4 size=16][4 "ftyp"][4 major-brand "isom"][4 minor-version=0]
 *   moov box  — [4 size   ][4 "moov"][payload bytes]
 *   mdat box  — [4 size=8 ][4 "mdat"]  (minimal media-data box)
 *
 * Both moov and mdat are required by isValidMp4Buffer; a file truncated before
 * mdat was written would be rejected even if moov is complete.
 */
function makeMinimalMp4(extraPayload = 0): Buffer {
  const ftypSize = 16;
  const moovSize = 8 + extraPayload;
  const mdatSize = 8; // minimal mdat: just the 8-byte header
  const total = ftypSize + moovSize + mdatSize;
  const buf = Buffer.alloc(total, 0x00);

  buf.writeUInt32BE(ftypSize, 0);
  buf.write("ftyp", 4, "ascii");
  buf.write("isom", 8, "ascii");
  buf.writeUInt32BE(0, 12); // minor version

  buf.writeUInt32BE(moovSize, ftypSize);
  buf.write("moov", ftypSize + 4, "ascii");

  buf.writeUInt32BE(mdatSize, ftypSize + moovSize);
  buf.write("mdat", ftypSize + moovSize + 4, "ascii");

  return buf;
}

/** Complete ftyp box only, no moov — simulates crash after header write. */
function makeFtypOnly(): Buffer {
  const buf = Buffer.alloc(16, 0x00);
  buf.writeUInt32BE(16, 0);
  buf.write("ftyp", 4, "ascii");
  buf.write("isom", 8, "ascii");
  return buf;
}

// ---------------------------------------------------------------------------
// isValidMp4Buffer — unit tests
// ---------------------------------------------------------------------------

describe("isValidMp4Buffer", () => {
  // --- fast-rejection cases ---

  it("rejects an empty buffer (fully empty file)", () => {
    expect(isValidMp4Buffer(Buffer.alloc(0))).toBe(false);
  });

  it("rejects a buffer shorter than 16 bytes (ftyp header not fully written)", () => {
    expect(isValidMp4Buffer(Buffer.alloc(8, 0x00))).toBe(false);
    expect(isValidMp4Buffer(Buffer.alloc(15, 0x00))).toBe(false);
  });

  it("rejects a 16-byte buffer of zeros (no ftyp magic)", () => {
    expect(isValidMp4Buffer(Buffer.alloc(16, 0x00))).toBe(false);
  });

  it("rejects a buffer whose bytes 4–7 are not ftyp", () => {
    const buf = Buffer.alloc(24, 0x00);
    buf.write("ftyx", 4, "ascii");
    expect(isValidMp4Buffer(buf)).toBe(false);
  });

  it("rejects a WebM file (EBML magic, not ftyp)", () => {
    const buf = Buffer.alloc(24, 0x00);
    buf[0] = 0x1a; buf[1] = 0x45; buf[2] = 0xdf; buf[3] = 0xa3;
    expect(isValidMp4Buffer(buf)).toBe(false);
  });

  // --- ftyp box completeness ---

  it("rejects when ftyp declared size exceeds buffer length (truncated mid-ftyp)", () => {
    const buf = Buffer.alloc(24, 0x00);
    buf.writeUInt32BE(100, 0);
    buf.write("ftyp", 4, "ascii");
    buf.write("isom", 8, "ascii");
    expect(isValidMp4Buffer(buf)).toBe(false);
  });

  it("rejects when ftyp declared size is less than 16 (malformed header)", () => {
    const buf = Buffer.alloc(24, 0x00);
    buf.writeUInt32BE(12, 0);
    buf.write("ftyp", 4, "ascii");
    buf.write("isom", 8, "ascii");
    expect(isValidMp4Buffer(buf)).toBe(false);
  });

  // --- moov presence and completeness ---

  it("rejects a file with only a complete ftyp box and no moov (crash after header)", () => {
    expect(isValidMp4Buffer(makeFtypOnly())).toBe(false);
  });

  it("rejects a file with ftyp followed by a free box but no moov", () => {
    const ftypSize = 16;
    const freeSize = 8;
    const buf = Buffer.alloc(ftypSize + freeSize, 0x00);
    buf.writeUInt32BE(ftypSize, 0);
    buf.write("ftyp", 4, "ascii");
    buf.write("isom", 8, "ascii");
    buf.writeUInt32BE(freeSize, ftypSize);
    buf.write("free", ftypSize + 4, "ascii");
    expect(isValidMp4Buffer(buf)).toBe(false);
  });

  it("rejects a buffer truncated after ftyp but before the full moov header", () => {
    // ftyp (16) + only 4 bytes of the moov header — type field not yet present
    const buf = Buffer.alloc(20, 0x00);
    buf.writeUInt32BE(16, 0);
    buf.write("ftyp", 4, "ascii");
    buf.write("isom", 8, "ascii");
    buf.writeUInt32BE(8, 16); // partial moov size field, no type bytes
    expect(isValidMp4Buffer(buf)).toBe(false);
  });

  it("rejects a buffer where moov declared size exceeds the buffer length (truncated mid-moov)", () => {
    // ftyp (16 bytes) + moov header claiming 10000 bytes but buffer ends here
    const buf = Buffer.alloc(24, 0x00);
    buf.writeUInt32BE(16, 0);
    buf.write("ftyp", 4, "ascii");
    buf.write("isom", 8, "ascii");
    buf.writeUInt32BE(10000, 16);
    buf.write("moov", 20, "ascii");
    expect(isValidMp4Buffer(buf)).toBe(false);
  });

  // --- mdat presence and completeness ---

  it("rejects ftyp+moov with no mdat (crash before media data was written)", () => {
    // Build ftyp + moov without mdat — simulates a crash after moov was fully
    // written but before the bulk mdat write started.
    const ftypSize = 16;
    const moovSize = 8;
    const buf = Buffer.alloc(ftypSize + moovSize, 0x00);
    buf.writeUInt32BE(ftypSize, 0);
    buf.write("ftyp", 4, "ascii");
    buf.write("isom", 8, "ascii");
    buf.writeUInt32BE(moovSize, ftypSize);
    buf.write("moov", ftypSize + 4, "ascii");
    expect(isValidMp4Buffer(buf)).toBe(false);
  });

  it("rejects ftyp+moov+truncated mdat (mdat declared size extends past buffer)", () => {
    // Build ftyp + moov + mdat whose size field claims far more bytes than the
    // buffer actually contains — simulates a crash mid-mdat write.
    const ftypSize = 16;
    const moovSize = 8;
    const mdatClaimedSize = 999999; // extends past buffer
    const buf = Buffer.alloc(ftypSize + moovSize + 8, 0x00); // only 8 mdat header bytes
    buf.writeUInt32BE(ftypSize, 0);
    buf.write("ftyp", 4, "ascii");
    buf.write("isom", 8, "ascii");
    buf.writeUInt32BE(moovSize, ftypSize);
    buf.write("moov", ftypSize + 4, "ascii");
    buf.writeUInt32BE(mdatClaimedSize, ftypSize + moovSize);
    buf.write("mdat", ftypSize + moovSize + 4, "ascii");
    expect(isValidMp4Buffer(buf)).toBe(false);
  });

  // --- acceptance cases ---

  it("accepts a minimal ftyp+moov+mdat buffer (32 bytes)", () => {
    expect(isValidMp4Buffer(makeMinimalMp4())).toBe(true);
  });

  it("accepts ftyp+moov with additional payload bytes in moov", () => {
    expect(isValidMp4Buffer(makeMinimalMp4(512))).toBe(true);
  });

  it("accepts ftyp+free+moov+mdat (moov is not the immediate successor of ftyp)", () => {
    const ftypSize = 16;
    const freeSize = 8;
    const moovSize = 8;
    const mdatSize = 8;
    const buf = Buffer.alloc(ftypSize + freeSize + moovSize + mdatSize, 0x00);
    buf.writeUInt32BE(ftypSize, 0);
    buf.write("ftyp", 4, "ascii");
    buf.write("isom", 8, "ascii");
    buf.writeUInt32BE(freeSize, ftypSize);
    buf.write("free", ftypSize + 4, "ascii");
    buf.writeUInt32BE(moovSize, ftypSize + freeSize);
    buf.write("moov", ftypSize + freeSize + 4, "ascii");
    buf.writeUInt32BE(mdatSize, ftypSize + freeSize + moovSize);
    buf.write("mdat", ftypSize + freeSize + moovSize + 4, "ascii");
    expect(isValidMp4Buffer(buf)).toBe(true);
  });

  it("accepts an mp42-branded ftyp box with moov and mdat", () => {
    const ftypSize = 16;
    const moovSize = 8;
    const mdatSize = 8;
    const buf = Buffer.alloc(ftypSize + moovSize + mdatSize, 0x00);
    buf.writeUInt32BE(ftypSize, 0);
    buf.write("ftyp", 4, "ascii");
    buf.write("mp42", 8, "ascii");
    buf.writeUInt32BE(moovSize, ftypSize);
    buf.write("moov", ftypSize + 4, "ascii");
    buf.writeUInt32BE(mdatSize, ftypSize + moovSize);
    buf.write("mdat", ftypSize + moovSize + 4, "ascii");
    expect(isValidMp4Buffer(buf)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// loadDiskCache integration tests
//
// These write actual temp files and confirm loadDiskCache accepts or rejects
// them correctly.  PROMO_EXPORT_CACHE_DIR is set before each test so
// getCacheDir() resolves to the test-local directory.
// ---------------------------------------------------------------------------

describe("loadDiskCache — corrupted cache file handling", () => {
  let testCacheDir: string;

  beforeEach(async () => {
    testCacheDir = await mkdtemp(path.join(tmpdir(), "export-cache-test-"));
    process.env["PROMO_EXPORT_CACHE_DIR"] = testCacheDir;
    resetRenderCacheForTest();
  });

  afterEach(() => {
    delete process.env["PROMO_EXPORT_CACHE_DIR"];
    resetRenderCacheForTest();
    try { rmSync(testCacheDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("populates renderCache when loadDiskCache finds a valid cache file on disk", async () => {
    // Use the same hash function loadDiskCache uses so the file name matches.
    const realHash = await computePromoSourceHash();
    const validMp4 = makeMinimalMp4(256);

    await mkdir(testCacheDir, { recursive: true });
    await writeFile(path.join(testCacheDir, `${realHash}.mp4`), validMp4);

    resetRenderCacheForTest();
    await loadDiskCache();

    const cache = getRenderCacheForTest();
    expect(cache).not.toBeNull();
    expect(cache?.buffer).toEqual(validMp4);
    expect(cache?.sourceHash).toBe(realHash);
  });

  it("leaves renderCache null when loadDiskCache finds a truncated file (ftyp only, no moov)", async () => {
    const realHash = await computePromoSourceHash();
    const truncated = makeFtypOnly();

    await mkdir(testCacheDir, { recursive: true });
    await writeFile(path.join(testCacheDir, `${realHash}.mp4`), truncated);

    resetRenderCacheForTest();
    await loadDiskCache();

    expect(getRenderCacheForTest()).toBeNull();
  });

  it("leaves renderCache null when loadDiskCache finds an empty file on disk", async () => {
    const realHash = await computePromoSourceHash();

    await mkdir(testCacheDir, { recursive: true });
    await writeFile(path.join(testCacheDir, `${realHash}.mp4`), Buffer.alloc(0));

    resetRenderCacheForTest();
    await loadDiskCache();

    expect(getRenderCacheForTest()).toBeNull();
  });

  it("leaves renderCache null when cache file has ftyp but moov is truncated mid-box", async () => {
    const realHash = await computePromoSourceHash();
    // ftyp (16) + moov header claiming 10000 bytes but buffer ends at 24
    const truncatedMoov = Buffer.alloc(24, 0x00);
    truncatedMoov.writeUInt32BE(16, 0);
    truncatedMoov.write("ftyp", 4, "ascii");
    truncatedMoov.write("isom", 8, "ascii");
    truncatedMoov.writeUInt32BE(10000, 16);
    truncatedMoov.write("moov", 20, "ascii");

    await mkdir(testCacheDir, { recursive: true });
    await writeFile(path.join(testCacheDir, `${realHash}.mp4`), truncatedMoov);

    resetRenderCacheForTest();
    await loadDiskCache();

    expect(getRenderCacheForTest()).toBeNull();
  });
});
