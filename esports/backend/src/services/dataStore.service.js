// Almacén de datos basado en archivos JSON (funciona sin MongoDB).
// Persiste en backend/data/<coleccion>.json. Pensado para que la plataforma
// sea funcional out-of-the-box; más adelante se puede cambiar por Mongo.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = path.join(__dirname, '..', '..', 'data')

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

export async function readCollection(name) {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${name}.json`), 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export async function writeCollection(name, data) {
  await ensureDir()
  await fs.writeFile(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2), 'utf8')
}

// Helpers para colecciones tipo lista (array).
export async function readList(name) {
  const data = await readCollection(name)
  return Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : []
}

export async function writeList(name, items) {
  await writeCollection(name, items)
}
