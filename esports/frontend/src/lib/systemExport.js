import { api } from './api.js'

// Export total real del sistema: conteos y entidades desde el servidor
// (GET /admin/export-system, queda en la bitacora de exportaciones). Antes
// descargaba el localStorage/sessionStorage del navegador del admin.
export async function downloadSystemExport(filename = null) {
  const data = await api('/admin/export-system')
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || `glitchgang-full-export-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

