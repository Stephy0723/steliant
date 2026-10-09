// Escapa metacaracteres de regex en input de usuario antes de usarlo en un
// $regex de MongoDB -- sin esto, un usuario puede mandar un patrón que cause
// backtracking catastrófico (ReDoS) o que amplíe/reduzca la búsqueda de forma
// inesperada (ej: mandar ".*" como query).
export function escapeRegex(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
