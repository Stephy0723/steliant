// ============================================
// GlitchGang Bot - Ogg Opus Writer
// ============================================
// Discord entrega la voz de cada usuario como paquetes Opus sueltos (sin
// contenedor). Escritos tal cual al disco (lo que hacia matchRecorder antes)
// no los abre ningun reproductor. Este escritor los mete en un contenedor
// Ogg Opus (RFC 7845), que el navegador reproduce directo con <audio>.
//
// Discord solo manda paquetes mientras la persona habla: los huecos se
// rellenan con tramas de silencio para que el tiempo del archivo coincida con
// el reloj de la partida y todas las pistas de una grabacion queden alineadas
// (el segundo 5:00 de cada jugador es el mismo momento de la partida).

const fs = require('fs');

const SAMPLE_RATE = 48000;
const FRAME_MS = 20;
// Trama Opus de silencio de 20 ms (la misma que usa @discordjs/voice).
const SILENCE_FRAME = Buffer.from([0xf8, 0xff, 0xfe]);
// Retrasos menores a esto son jitter de red, no silencio.
const GAP_TOLERANCE_MS = 120;
const PAGE_MAX_SEGMENTS = 200;
const PAGE_MAX_BYTES = 8 * 1024;
// Tope por si el reloj salta: nunca rellenar mas de 6 h de silencio.
const MAX_GAP_MS = 6 * 60 * 60 * 1000;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) r = (r & 0x80000000) ? ((r << 1) ^ 0x04c11db7) : (r << 1);
    table[i] = r >>> 0;
  }
  return table;
})();

function oggCrc(buffer) {
  let crc = 0;
  for (let i = 0; i < buffer.length; i++) {
    crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ buffer[i]) & 0xff]) >>> 0;
  }
  return crc >>> 0;
}

// Muestras (a 48 kHz) que dura un paquete Opus, segun su byte TOC (RFC 6716 3.1).
function packetSamples(packet) {
  if (!packet?.length) return 0;
  const toc = packet[0];
  const config = toc >> 3;
  let frameSamples;
  if (config < 12) frameSamples = [480, 960, 1920, 2880][config & 3];       // SILK 10/20/40/60 ms
  else if (config < 16) frameSamples = [480, 960][config & 1];              // Hibrido 10/20 ms
  else frameSamples = [120, 240, 480, 960][config & 3];                     // CELT 2.5/5/10/20 ms
  const code = toc & 3;
  const frames = code === 0 ? 1 : code === 3 ? (packet[1] & 0x3f) : 2;
  return frameSamples * Math.max(1, frames);
}

class OggOpusWriter {
  /**
   * @param {string} filePath  destino .ogg
   * @param {object} opts
   * @param {number} opts.startedAt  epoch ms del inicio de la grabacion (origen del tiempo)
   */
  constructor(filePath, { startedAt = Date.now(), channels = 2 } = {}) {
    this.filePath = filePath;
    this.startedAt = startedAt;
    this.channels = channels;
    this.serial = Math.floor(Math.random() * 0xffffffff) >>> 0;
    this.sequence = 0;
    this.granule = 0;          // muestras ya escritas (a 48 kHz)
    this.pending = [];         // paquetes del proximo page
    this.pendingBytes = 0;
    this.pendingSegments = 0;
    this.packets = 0;         // paquetes de voz reales (sin el silencio de relleno)
    this.closed = false;
    this.stream = fs.createWriteStream(filePath);
    this.writeHeaders();
  }

  writeHeaders() {
    const head = Buffer.alloc(19);
    head.write('OpusHead', 0, 'ascii');
    head.writeUInt8(1, 8);                 // version
    head.writeUInt8(this.channels, 9);
    head.writeUInt16LE(312, 10);           // pre-skip (valor por defecto de libopus)
    head.writeUInt32LE(SAMPLE_RATE, 12);
    head.writeInt16LE(0, 16);              // output gain
    head.writeUInt8(0, 18);                // mapping family 0 (mono/estereo)
    this.writePage([head], 0, 0x02);

    const vendor = Buffer.from('GlitchGang match recorder', 'utf8');
    const tags = Buffer.alloc(8 + 4 + vendor.length + 4);
    tags.write('OpusTags', 0, 'ascii');
    tags.writeUInt32LE(vendor.length, 8);
    vendor.copy(tags, 12);
    tags.writeUInt32LE(0, 12 + vendor.length);
    this.writePage([tags], 0, 0x00);
  }

  writePage(packets, granule, headerType) {
    const lacing = [];
    for (const packet of packets) {
      let size = packet.length;
      while (size >= 255) { lacing.push(255); size -= 255; }
      lacing.push(size);
    }
    const header = Buffer.alloc(27 + lacing.length);
    header.write('OggS', 0, 'ascii');
    header.writeUInt8(0, 4);
    header.writeUInt8(headerType, 5);
    header.writeBigInt64LE(BigInt(granule), 6);
    header.writeUInt32LE(this.serial, 14);
    header.writeUInt32LE(this.sequence++, 18);
    header.writeUInt32LE(0, 22);            // CRC, se calcula con el campo en 0
    header.writeUInt8(lacing.length, 26);
    Buffer.from(lacing).copy(header, 27);
    const page = Buffer.concat([header, ...packets]);
    page.writeUInt32LE(oggCrc(page), 22);
    this.stream.write(page);
  }

  push(packet) {
    const segments = Math.floor(packet.length / 255) + 1;
    if (this.pending.length && (this.pendingSegments + segments > PAGE_MAX_SEGMENTS || this.pendingBytes + packet.length > PAGE_MAX_BYTES)) {
      this.flush(0x00);
    }
    this.pending.push(packet);
    this.pendingSegments += segments;
    this.pendingBytes += packet.length;
    this.granule += packetSamples(packet);
  }

  flush(headerType) {
    if (!this.pending.length) return;
    this.writePage(this.pending, this.granule, headerType);
    this.pending = [];
    this.pendingSegments = 0;
    this.pendingBytes = 0;
  }

  /** Rellena con silencio hasta el instante `atMs` (epoch) del reloj de la partida. */
  padTo(atMs) {
    const targetMs = Math.min(Math.max(0, atMs - this.startedAt), MAX_GAP_MS + this.positionMs());
    const frames = Math.floor((targetMs - this.positionMs()) / FRAME_MS);
    for (let i = 0; i < frames; i++) this.push(SILENCE_FRAME);
  }

  positionMs() {
    return (this.granule / SAMPLE_RATE) * 1000;
  }

  /** Un paquete Opus recibido de Discord en el instante `receivedAt` (epoch ms). */
  writePacket(packet, receivedAt = Date.now()) {
    if (this.closed || !packet?.length) return;
    if (receivedAt - this.startedAt - this.positionMs() > GAP_TOLERANCE_MS) this.padTo(receivedAt);
    this.push(Buffer.from(packet));
    this.packets += 1;
  }

  /** Cierra el archivo, rellenando con silencio hasta `stoppedAt` para que todas las pistas duren lo mismo. */
  end(stoppedAt = Date.now()) {
    if (this.closed) return Promise.resolve(this.summary());
    this.closed = true;
    this.padTo(stoppedAt);
    if (!this.pending.length) this.push(SILENCE_FRAME);
    this.flush(0x04);
    return new Promise((resolve, reject) => {
      this.stream.on('error', reject);
      this.stream.end(() => resolve(this.summary()));
    });
  }

  summary() {
    return { filePath: this.filePath, durationMs: Math.round(this.positionMs()), voicePackets: this.packets };
  }
}

module.exports = { OggOpusWriter, packetSamples, oggCrc };
