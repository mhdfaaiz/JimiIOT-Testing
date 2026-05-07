/**
 * Minimal FLV muxer for H.264 video from reassembled JT/T 1078 frames.
 *
 * Produces a valid FLV byte-stream suitable for flv.js browser playback.
 * Only video (H.264) is handled; audio is intentionally skipped for now.
 */

// ── FLV primitives ────────────────────────────────────────────────────────────

/**
 * Return a 13-byte FLV file header.
 *   "FLV" + version(1) + flags(1=audio,4=video,5=both) + dataOffset(4) + PreviousTagSize0(4)
 */
export function flvFileHeader() {
  const b = Buffer.alloc(13);
  b.write("FLV", 0, "ascii");
  b.writeUInt8(0x01, 3);   // version 1
  b.writeUInt8(0x04, 4);   // video only
  b.writeUInt32BE(9, 5);   // DataOffset = 9
  b.writeUInt32BE(0, 9);   // PreviousTagSize0
  return b;
}

/**
 * Build one FLV tag (header + payload + PreviousTagSize).
 * @param {number} tagType  8=audio  9=video  18=script
 * @param {Buffer} payload
 * @param {number} timestampMs  presentation timestamp in ms
 */
function flvTag(tagType, payload, timestampMs) {
  const ts  = Math.max(0, timestampMs >>> 0);
  const hdr = Buffer.alloc(11);
  hdr.writeUInt8(tagType, 0);
  hdr.writeUIntBE(payload.length, 1, 3);
  hdr.writeUIntBE(ts & 0xffffff, 4, 3);
  hdr.writeUInt8((ts >>> 24) & 0xff, 7);
  hdr.writeUIntBE(0, 8, 3);                // stream ID = 0
  const prevSize = Buffer.alloc(4);
  prevSize.writeUInt32BE(11 + payload.length);
  return Buffer.concat([hdr, payload, prevSize]);
}

// ── H.264 helpers ─────────────────────────────────────────────────────────────

/**
 * Parse an H.264 Annex B bitstream into individual NAL unit Buffers
 * (start codes stripped, no zero-byte padding).
 *
 * Supports both 3-byte (00 00 01) and 4-byte (00 00 00 01) start codes.
 *
 * @param {Buffer} buf
 * @returns {Buffer[]}
 */
export function parseAnnexB(buf) {
  if (!buf || buf.length === 0) return [];
  const nalus = [];
  const len   = buf.length;
  let i = 0;

  while (i < len) {
    // Detect start code
    let sc = 0;
    if (i + 3 < len && buf[i] === 0 && buf[i+1] === 0 && buf[i+2] === 0 && buf[i+3] === 1) sc = 4;
    else if (i + 2 < len && buf[i] === 0 && buf[i+1] === 0 && buf[i+2] === 1) sc = 3;
    else { i++; continue; }

    const start = i + sc;
    // Scan for the next start code
    let end = start;
    while (end < len) {
      if (end + 3 < len && buf[end] === 0 && buf[end+1] === 0 && buf[end+2] === 0 && buf[end+3] === 1) break;
      if (end + 2 < len && buf[end] === 0 && buf[end+1] === 0 && buf[end+2] === 1) break;
      end++;
    }
    if (end > start) nalus.push(buf.slice(start, end));
    i = end;
  }
  return nalus;
}

/**
 * Build an AVCDecoderConfigurationRecord from raw SPS and PPS NAL buffers.
 * @param {Buffer} sps  SPS NAL unit (no start code)
 * @param {Buffer} pps  PPS NAL unit (no start code)
 * @returns {Buffer|null}
 */
function buildAvcConfig(sps, pps) {
  if (!sps || sps.length < 4 || !pps) return null;
  const r = Buffer.alloc(11 + sps.length + pps.length);
  let o = 0;
  r.writeUInt8(1,        o++);              // configurationVersion = 1
  r.writeUInt8(sps[1],   o++);              // AVCProfileIndication
  r.writeUInt8(sps[2],   o++);              // profile_compatibility
  r.writeUInt8(sps[3],   o++);              // AVCLevelIndication
  r.writeUInt8(0xff,     o++);              // reserved(6) | lengthSizeMinusOne(2)=3 → 4-byte lengths
  r.writeUInt8(0xe1,     o++);              // reserved(3) | numSPS(5)=1
  r.writeUInt16BE(sps.length, o); o += 2;
  sps.copy(r, o); o += sps.length;
  r.writeUInt8(1,        o++);              // numPPS = 1
  r.writeUInt16BE(pps.length, o); o += 2;
  pps.copy(r, o);
  return r;
}

/**
 * Convert an array of raw NAL unit Buffers to AVCC format
 * (each preceded by a 4-byte big-endian length).
 * @param {Buffer[]} nalus
 * @returns {Buffer}
 */
function nalusToAvcc(nalus) {
  if (nalus.length === 0) return Buffer.alloc(0);
  return Buffer.concat(
    nalus.flatMap(n => {
      const l = Buffer.alloc(4);
      l.writeUInt32BE(n.length);
      return [l, n];
    })
  );
}

// ── FlvMuxer ──────────────────────────────────────────────────────────────────

/**
 * Per-subscriber FLV muxer for live H.264 streams.
 *
 * Usage:
 *   const mux = new FlvMuxer();
 *   ws.send(mux.header(), { binary: true });           // once on connect
 *
 *   // If SPS/PPS already available from a previous frame, prime immediately:
 *   if (cachedSps && cachedPps) {
 *     mux.prime(cachedSps, cachedPps);
 *     mux.getSeqHeader().forEach(c => ws.send(c, { binary: true }));
 *   }
 *
 *   // For each assembled JT1078 video frame:
 *   mux.push(frame).forEach(c => ws.send(c, { binary: true }));
 */
export class FlvMuxer {
  constructor() {
    this._sps     = null;
    this._pps     = null;
    this._seqSent = false;
    this._t0      = null;   // wall-clock ms of first frame (used for relative timestamps)
  }

  /** Return the FLV file header Buffer (send once to each subscriber). */
  header() { return flvFileHeader(); }

  /**
   * Pre-populate SPS/PPS so getSeqHeader() can be called immediately.
   * @param {Buffer} sps
   * @param {Buffer} pps
   */
  prime(sps, pps) {
    this._sps = Buffer.from(sps);
    this._pps = Buffer.from(pps);
  }

  /**
   * Emit the AVC sequence header FLV tag if SPS/PPS are available and not yet sent.
   * @returns {Buffer[]}
   */
  getSeqHeader() {
    if (!this._sps || !this._pps || this._seqSent) return [];
    const rec = buildAvcConfig(this._sps, this._pps);
    if (!rec) return [];
    const pl = Buffer.alloc(5 + rec.length);
    pl.writeUInt8(0x17, 0);          // keyframe(1) | AVC codec(7)
    pl.writeUInt8(0x00, 1);          // AVCPacketType = sequence header
    pl.writeUIntBE(0, 2, 3);         // compositionTime = 0
    rec.copy(pl, 5);
    this._seqSent = true;
    return [flvTag(9, pl, 0)];
  }

  /**
   * Process one reassembled video frame and return FLV chunk Buffers to send.
   *
   * @param {{ payloadType: string, data: Buffer, timestampMs?: number }} frame
   * @returns {Buffer[]}
   */
  push({ payloadType, data, timestampMs }) {
    if (!payloadType || !payloadType.startsWith("video")) return [];
    const isKey = payloadType === "video-I";
    return this._processH264(data, isKey, timestampMs ?? null);
  }

  _processH264(buf, isKey, tsMs) {
    const out = [];

    if (this._t0 === null) this._t0 = tsMs ?? Date.now();
    const relMs = tsMs != null
      ? Math.max(0, tsMs - this._t0)
      : Math.max(0, Date.now() - this._t0);

    const nalus = parseAnnexB(buf);
    if (nalus.length === 0) return out;

    const dataNalus = [];
    let spsUpdated = false;
    let ppsUpdated = false;

    for (const n of nalus) {
      const naluType = n[0] & 0x1f;
      if      (naluType === 7)  { this._sps = n; spsUpdated = true; }
      else if (naluType === 8)  { this._pps = n; ppsUpdated = true; }
      else if (naluType === 9 || naluType === 12) { /* AUD / filler — skip */ }
      else dataNalus.push(n);
    }

    // Emit AVC sequence header when SPS+PPS first available or when they change
    if (this._sps && this._pps && (!this._seqSent || spsUpdated || ppsUpdated)) {
      const seqChunks = this.getSeqHeader();
      out.push(...seqChunks);
    }

    if (dataNalus.length === 0 || !this._seqSent) return out;

    const avccBuf = nalusToAvcc(dataNalus);
    const ft      = isKey ? 1 : 2;
    const pl      = Buffer.alloc(5 + avccBuf.length);
    pl.writeUInt8((ft << 4) | 7, 0);   // frameType | AVC codec
    pl.writeUInt8(0x01, 1);             // AVCPacketType = NALU
    pl.writeUIntBE(0, 2, 3);            // compositionTime
    avccBuf.copy(pl, 5);
    out.push(flvTag(9, pl, relMs));

    return out;
  }
}
