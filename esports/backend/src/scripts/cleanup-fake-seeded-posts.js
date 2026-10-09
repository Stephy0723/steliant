import 'dotenv/config'
import { connectDatabase, disconnectDatabase } from '../database/mongo.js'
import { Post } from '../models/Post.js'
import { Comment } from '../models/Comment.js'

// Borra los posts que `listPosts` insertaba solo en Mongo cuando la coleccion
// estaba vacia (auto-siembra), atribuidos a los primeros 3 usuarios reales
// que encontrara -- no es contenido que esos usuarios hayan publicado. Ver
// BACKEND-PENDIENTE.md #posts-auto-siembra-falsa. Identificados por el texto
// fijo exacto que usaba el bloque de siembra (borrado del controller en el
// mismo commit que agrega este script).
const FAKE_TEXTS = [
  'Inscripciones abiertas para el GG Summer Open. Cupos limitados, ¡regístrate ya!',
  'Clutch 1v5 en la final de la liga interna 🔥',
  'Nueva guía de setups de humo para todos los mapas. Link en comentarios.'
]

const DRY_RUN = process.argv.includes('--dry-run')

async function cleanupFakeSeededPosts() {
  await connectDatabase()

  const fakePosts = await Post.find({ text: { $in: FAKE_TEXTS } })
    .select('_id text authorNick likes createdAt')
    .lean()

  if (!fakePosts.length) {
    console.log('No se encontraron posts falsos con el texto de la auto-siembra. Nada que limpiar.')
    return
  }

  for (const post of fakePosts) {
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}${post._id} -- autor: ${post.authorNick} -- likes: ${post.likes} -- creado: ${post.createdAt} -- "${post.text.slice(0, 60)}..."`)
  }

  if (DRY_RUN) {
    console.log(`\n${fakePosts.length} post(s) encontrados (dry-run, no se borró nada). Corré sin --dry-run para borrarlos.`)
    return
  }

  const ids = fakePosts.map(p => p._id)
  const { deletedCount: commentsDeleted } = await Comment.deleteMany({ post: { $in: ids } })
  const { deletedCount: postsDeleted } = await Post.deleteMany({ _id: { $in: ids } })

  console.log(`\nListo: ${postsDeleted} post(s) falso(s) borrados (y ${commentsDeleted} comentario(s) asociados).`)
}

cleanupFakeSeededPosts()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(disconnectDatabase)
