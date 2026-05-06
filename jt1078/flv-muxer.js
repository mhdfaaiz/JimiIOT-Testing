/**
 * Minimal FLV-over-WebSocket muxer for H.264 live streaming.
 *
 * The output is a valid FLV byte-stream that can be piped directly to a
 * WebSocket client and consumed by flv.js in the browser.
 *
 * Only H.264/AVC video is supported for browser playback.  H.265/HEVC is
 * detected and signalled so the caller can inform the client gracefully.
 */

// ─── FLV container helpers ────────────────────────────────────────────────────

/**
 * Build the 13-byte stream prefix that must be sent once per WebSocket client.
 *   9 bytes – FLV file header
 *   4 bytes – PreviousTagSize0 (always 0)
 *
 * @returns {Buffer}
 */
export function makeFLVHeader() {
  const buf = Buffer.allocUnsafe(13);
  buf[0] = 0x46; // 'F'
  buf[1] = 0x4c; // 'L'
  buf[2] = 0x56; // 'V'
  buf[3] = 0x01; // version 1
  // TypeFlags: bit0 = video present, bit2 = audio present
  // video-only → 0x01
  buf[4] = 0x01;
  buf.writeUInt32BE(9, 5); // DataOffset = 9
  buf.writeUInt32BE(0, 9); // PreviousTagSize0 = 0
  return buf;
}

/**
 * Wrap video/audio/script data in a single FLV tag + trailing PreviousTagSize.
 *
 * @param {number} tagType  – 8=audio, 9=video, 18=script
 * @param {Buffer} data     – tag payload
 * @param {number} timestamp – milliseconds (32-bit, wraps at ~49 days)
 * @returns {Buffer}
 */
function makeTag(tagType, data, timestamp) {
  const ts = (timestamp >>> 0); // ensure unsigned 32-bit
  const tagBodySize = 11 + data.length;
  const buf = Buffer.allocUnsafe(tagBodySize + 4);

  buf[0] = tagType & 0xff;
  // DataSize (24-bit big-endian)
  buf[1] = (data.length >> 16) & 0xff;
  buf[2] = (data.length >> 8) & 0xff;
  buf[3] = data.length & 0xff;
  // Timestamp lower 24 bits (big-endian) + TimestampExtended (upper 8 bits)
  buf[4] = (ts >> 16) & 0xff;
  buf[5] = (ts >> 8) & 0xff;
  buf[6] = ts & 0xff;
  buf[7] = (ts >> 24) & 0xff; // TimestampExtended
  // StreamID – always 0 (3 bytes)
  buf[8] = 0;
  buf[9] = 0;
  buf[10] = 0;
  data.copy(buf, 11);
  // PreviousTagSize = 11 (tag header) + data.length
  buf.writeUInt32BE(tagBodySize, tagBodySize);
  return buf;
}

// ─── H.264 / AVC video tag builders ──────────────────────────────────────────

/**
 * Build an AVC sequence-header FLV tag (AVCDecoderConfigurationRecord).
 * This must be sent once before any NALU tags.  Send again whenever the
 * stream restarts or SPS/PPS change.
 *
 * @param {Buffer} sps       – raw SPS NAL unit bytes (no start code)
 * @param {Buffer} pps       – raw PPS NAL unit bytes (no start code)
 * @param {number} [ts=0]    – timestamp in ms
 * @returns {Buffer}
 */
export function makeAVCSequenceHeaderTag(sps, pps, ts = 0) {
  const avcCfg = buildAVCDecoderConfig(sps, pps);
  // Video data: [FrameType|CodecID][AVCPacketType][CompositionTime(3)]
  const videoData = Buffer.allocUnsafe(5 + avcCfg.length);
  videoData[0] = (1 << 4) | 7; // FrameType=1(keyframe), CodecID=7(AVC)
  videoData[1] = 0;             // AVCPacketType=0 (sequence header)
  videoData[2] = 0;             // CompositionTime (3 bytes, = 0)
  videoData[3] = 0;
  videoData[4] = 0;
  avcCfg.copy(videoData, 5);
  return makeTag(9, videoData, ts);
}

/**
 * Build an AVC NALU FLV video tag from one or more raw NAL unit buffers.
 *
 * @param {Buffer[]} nalUnits – raw NAL unit buffers (no start codes)
 * @param {boolean}  isKeyframe
 * @param {number}   ts        – timestamp in ms
 * @returns {Buffer}
 */
export function makeAVCNALUTag(nalUnits, isKeyframe, ts) {
  // Convert each NAL unit to AVCC format: 4-byte big-endian length prefix
  const avccParts = nalUnits.map((nal) => {
    const lenBuf = Buffer.allocUnsafe(4);
    lenBuf.writeUInt32BE(nal.length, 0);
    return Buffer.concat([lenBuf, nal]);
  });
  const avccData = Buffer.concat(avccParts);

  const videoData = Buffer.allocUnsafe(5 + avccData.length);
  videoData[0] = ((isKeyframe ? 1 : 2) << 4) | 7; // FrameType | CodecID=7
  videoData[1] = 1;  // AVCPacketType=1 (NALUs)
  videoData[2] = 0;  // CompositionTime
  videoData[3] = 0;
  videoData[4] = 0;
  avccData.copy(videoData, 5);
  return makeTag(9, videoData, ts);
}

/**
 * Build the AVCDecoderConfigurationRecord from raw SPS and PPS NAL units.
 *
 * @param {Buffer} sps
 * @param {Buffer} pps
 * @returns {Buffer}
 */
function buildAVCDecoderConfig(sps, pps) {
  if (!sps || sps.length < 4) throw new Error(`SPS too short to build AVCDecoderConfig (length: ${sps?.length ?? 0}, minimum: 4)`);
  // Fixed header (6) + SPS len(2) + SPS + num_pps(1) + PPS len(2) + PPS
  const out = Buffer.allocUnsafe(11 + sps.length + pps.length);
  let o = 0;
  out[o++] = 0x01;       // configurationVersion
  out[o++] = sps[1];     // AVCProfileIndication
  out[o++] = sps[2];     // profile_compatibility
  out[o++] = sps[3];     // AVCLevelIndication
  out[o++] = 0xff;       // lengthSizeMinusOne = 3 → 4-byte length prefixes
  out[o++] = 0xe1;       // numSequenceParameterSets = 1 (0b11100001)
  out.writeUInt16BE(sps.length, o); o += 2;
  sps.copy(out, o); o += sps.length;
  out[o++] = 0x01;       // numPictureParameterSets = 1
  out.writeUInt16BE(pps.length, o); o += 2;
  pps.copy(out, o); o += pps.length;
  return out.subarray(0, o);
}

// ─── Annex B NAL unit parsing ─────────────────────────────────────────────────

/**
 * Split an Annex-B encoded buffer (start-code delimited) into individual
 * raw NAL unit buffers, with the start codes removed.
 *
 * If no start codes are found the whole buffer is returned as a single NAL unit.
 *
 * @param {Buffer} buf
 * @returns {Buffer[]}
 */
export function splitAnnexBNalUnits(buf) {
  // Collect the position of every start-code and the first byte of the NAL unit that follows.
  const sc = []; // { scPos, nalPos }
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] !== 0x00) continue;
    if (i + 2 < buf.length && buf[i + 1] === 0x00 && buf[i + 2] === 0x01) {
      sc.push({ scPos: i, nalPos: i + 3 });
      i += 2;
    } else if (i + 3 < buf.length && buf[i + 1] === 0x00 && buf[i + 2] === 0x00 && buf[i + 3] === 0x01) {
      sc.push({ scPos: i, nalPos: i + 4 });
      i += 3;
    }
  }

  if (sc.length === 0) {
    return buf.length > 0 ? [buf] : [];
  }

  const units = [];
  for (let j = 0; j < sc.length; j++) {
    const { nalPos } = sc[j];
    // NAL unit ends just before the start-code of the next unit (or at buffer end).
    const end = j + 1 < sc.length ? sc[j + 1].scPos : buf.length;
    if (end > nalPos) units.push(buf.subarray(nalPos, end));
  }
  return units.filter((u) => u.length > 0);
}

// ─── Codec detection & NAL classification ────────────────────────────────────

/**
 * Detect the video codec from a raw frame buffer.
 * Inspects NAL unit type bytes after splitting on Annex-B start codes.
 *
 * @param {Buffer} buf
 * @returns {'h264'|'h265'|'unknown'}
 */
export function detectCodec(buf) {
  if (!buf || buf.length === 0) return "unknown";
  const nals = splitAnnexBNalUnits(buf);
  for (const nal of nals) {
    if (nal.length === 0) continue;
    const byte0 = nal[0];

    // H.264 NAL unit type occupies bits[4:0] of the first byte.
    // Types 1–23 are H.264 VCL / non-VCL units.
    const h264Type = byte0 & 0x1f;
    if (h264Type >= 1 && h264Type <= 23) return "h264";

    // H.265 NAL unit type occupies bits[6:1] of the first byte (nal_unit_type).
    // Types 0–47 are H.265 units; VPS=32, SPS=33, PPS=34; IDR=19/20.
    // Bit 7 of the first byte must be 0 (forbidden_zero_bit).
    if ((byte0 & 0x80) === 0) {
      const h265Type = (byte0 & 0x7e) >> 1;
      if (h265Type >= 0 && h265Type <= 47) return "h265";
    }
  }
  return "unknown";
}

/**
 * Extract SPS and PPS NAL units from a parsed NAL unit array.
 *
 * @param {Buffer[]} nalUnits
 * @returns {{ sps: Buffer|null, pps: Buffer|null }}
 */
export function extractSPSPPS(nalUnits) {
  let sps = null;
  let pps = null;
  for (const nal of nalUnits) {
    if (nal.length === 0) continue;
    const type = nal[0] & 0x1f;
    if (type === 7) sps = nal;      // SPS
    else if (type === 8) pps = nal; // PPS
  }
  return { sps, pps };
}

/**
 * Return true if any NAL unit in the array is an H.264 IDR (keyframe).
 *
 * @param {Buffer[]} nalUnits
 * @returns {boolean}
 */
export function isH264Keyframe(nalUnits) {
  return nalUnits.some((nal) => nal.length > 0 && (nal[0] & 0x1f) === 5);
}
