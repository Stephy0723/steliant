import { api } from './api.js'

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Sube un archivo (imagen/PDF/video) al backend real (POST /uploads) y
// devuelve { url, name, originalName } — la url queda servida en /uploads/<name>.
export async function uploadFile(file) {
  const dataUrl = await fileToDataUrl(file)
  return api('/uploads', { method: 'POST', body: { dataUrl, filename: file.name } })
}

