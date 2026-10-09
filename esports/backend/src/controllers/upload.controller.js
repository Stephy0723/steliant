// Subida de archivos (capturas de justificación, banners, logos, PDF de reglas).
// Recibe dataURL en JSON y guarda en backend/uploads. Más adelante se puede
// cambiar el destino a S3/Cloudinary sin tocar el frontend (mismo contrato → { url }).
import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads')

const EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

// Firma (magic bytes) de cada tipo: evita que un HTML/JS se suba diciendo ser imagen.
function matchesSignature(mime, buf) {
  const hex = buf.subarray(0, 12).toString('hex')
  const ascii = buf.subarray(0, 12).toString('latin1')
  switch (mime) {
    case 'image/png': return hex.startsWith('89504e470d0a1a0a')
    case 'image/jpeg': return hex.startsWith('ffd8ff')
    case 'image/gif': return ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a')
    case 'image/webp': return ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP'
    case 'application/pdf': return ascii.startsWith('%PDF-')
    case 'video/mp4': return ascii.slice(4, 8) === 'ftyp'
    case 'video/webm': return hex.startsWith('1a45dfa3')
    default: return false
  }
}

export async function uploadFile(req, res, next) {
  try {
    const { dataUrl, filename } = req.body || {}
    if (!dataUrl || typeof dataUrl !== 'string') {
      const e = new Error('Falta dataUrl'); e.status = 400; throw e
    }
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) { const e = new Error('Formato dataUrl inválido'); e.status = 400; throw e }
    const mime = match[1]
    // Solo tipos conocidos: antes cualquier cosa se guardaba como .bin y el
    // servidor servía de alojamiento gratis para cualquier archivo.
    const ext = EXT[mime]
    if (!ext) { const e = new Error('Tipo de archivo no permitido (PNG, JPG, WEBP, GIF, PDF, MP4 o WEBM).'); e.status = 415; throw e }
    const buffer = Buffer.from(match[2], 'base64')
    const limit = mime.startsWith('video/') ? 60 * 1024 * 1024 : 8 * 1024 * 1024
    if (buffer.length > limit) { const e = new Error(mime.startsWith('video/') ? 'Video supera 60MB' : 'Archivo supera 8MB'); e.status = 413; throw e }
    if (!matchesSignature(mime, buffer)) { const e = new Error('El contenido del archivo no coincide con su tipo.'); e.status = 415; throw e }

    await fs.mkdir(UPLOAD_DIR, { recursive: true })
    const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`
    await fs.writeFile(path.join(UPLOAD_DIR, name), buffer)

    const url = `/uploads/${name}`
    res.status(201).json({ url, name, originalName: filename || null })
  } catch (e) { next(e) }
}
