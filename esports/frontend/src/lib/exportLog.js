import { api } from './api.js'

// Bitacora de exportaciones del panel admin, persistida en el servidor
// (GET/POST /admin/export-logs). Quien exporta y su IP los pone el backend
// a partir de la sesion -- antes vivia en memoria del navegador y consultaba
// la IP a un servicio externo (ipify).
export async function loadExportLogs() {
  try {
    const res = await api('/admin/export-logs')
    return Array.isArray(res.logs) ? res.logs : []
  } catch {
    return []
  }
}

export async function logExport({
  action = 'Exportacion PDF', entity = '-', recordId = '-', fileType = 'PDF',
  period = '-', season = '-', count = 0, printCode = '-',
} = {}) {
  try {
    const res = await api('/admin/export-logs', {
      method: 'POST',
      body: { action, entity, recordId, fileType, period, season, count, printCode },
    })
    return res.log
  } catch {
    return null
  }
}

