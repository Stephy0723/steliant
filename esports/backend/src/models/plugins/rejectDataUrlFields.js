// Guarda universal, a nivel de persistencia: NINGUN modelo puede guardar un
// data: URI (base64 embebido) en un campo de texto, sin importar el nombre
// del campo ni que tan anidado este. Encontrado dos veces en la misma
// sesion (MyTeamPanel.jsx: logo de sponsor y avatar de roster guardados
// como base64 crudo cuando el upload real a /uploads fallaba o directamente
// nunca se llamaba) -- cada vez que esto pasa, el documento se infla y la
// imagen termina rota en pantalla ("Data URL decoding failed"). Arreglar
// cada punto del frontend uno por uno es fragil (exactamente lo que ya paso
// dos veces); esto lo bloquea en el unico lugar por el que TODO termina
// pasando: el guardado en Mongo, para cualquier campo, de cualquier modelo,
// presente o futuro.
const DATA_URI_PATTERN = /^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/i
const MAX_DEPTH = 8

function findDataUrls(value, path, depth, hits) {
  if (hits.length >= 5 || depth > MAX_DEPTH || value == null) return
  if (typeof value === 'string') {
    if (DATA_URI_PATTERN.test(value)) hits.push(path || '(root)')
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => findDataUrls(item, `${path}[${i}]`, depth + 1, hits))
    return
  }
  if (typeof value === 'object') {
    // Buffer/Date/ObjectId-like: no son texto de usuario, no hace falta bajar.
    if (value instanceof Date || Buffer.isBuffer(value)) return
    for (const [key, inner] of Object.entries(value)) {
      if (key === '_id' || key === '__v') continue
      findDataUrls(inner, path ? `${path}.${key}` : key, depth + 1, hits)
    }
  }
}

function guardOrThrow(hits) {
  if (!hits.length) return
  throw new Error(
    `No se puede guardar un archivo como data: URI embebido (campo${hits.length > 1 ? 's' : ''}: ${hits.join(', ')}). ` +
    'Subi el archivo primero via /uploads y guarda la URL real que devuelve, no el base64.',
  )
}

export function rejectDataUrlFields(schema) {
  // Cubre document.save()/Model.create()/Model.insertMany() -- la gran
  // mayoria de las escrituras en este codebase para campos anidados
  // (staffMembers, rosterSlots, sponsors...), que es exactamente donde
  // aparecio el bug las dos veces.
  schema.pre('validate', function (next) {
    try {
      const hits = []
      findDataUrls(this.toObject({ depopulate: true }), '', 0, hits)
      guardOrThrow(hits)
      next()
    } catch (err) { next(err) }
  })

  // Cubre Model.updateOne()/findOneAndUpdate()/updateMany() -- estos NO
  // pasan por pre('validate') ni siquiera con runValidators:true (esa opcion
  // solo corre los validators de schema por-campo, no el middleware de
  // documento). Se inspecciona el update crudo ($set y raiz) antes de que
  // llegue a Mongo.
  const guardUpdate = function (next) {
    try {
      const update = this.getUpdate() || {}
      const hits = []
      findDataUrls(update.$set || {}, '', 0, hits)
      findDataUrls(
        Object.fromEntries(Object.entries(update).filter(([key]) => !key.startsWith('$'))),
        '', 0, hits,
      )
      guardOrThrow(hits)
      next()
    } catch (err) { next(err) }
  }
  schema.pre('updateOne', guardUpdate)
  schema.pre('updateMany', guardUpdate)
  schema.pre('findOneAndUpdate', guardUpdate)
}
