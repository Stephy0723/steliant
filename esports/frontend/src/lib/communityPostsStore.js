function disabledPostsWarning(action) {
  console.warn(`[GlitchGang] ${action} local de posts de comunidad deshabilitado. Usa /posts.`)
}

export function loadPosts() {
  return []
}

export function addPost() {
  disabledPostsWarning('Creacion')
  return []
}

export function updatePost() {
  disabledPostsWarning('Actualizacion')
  return []
}

export function removePost() {
  disabledPostsWarning('Eliminacion')
  return []
}

export function votePoll() {
  disabledPostsWarning('Voto')
  return []
}

