// ════════════════════════════════════════════════════════════
//  Solo se anima lo que se esta viendo.
//
//  Al cambiar de pagina React ya desmonta la anterior (sus animaciones
//  desaparecen solas). Lo que si se acumulaba eran las animaciones en bucle
//  (animation-iteration-count: infinite) de cosas que existen pero no se ven:
//  lo que queda abajo del scroll, menus/paneles ocultos, y todo cuando la
//  pestaña o la app estan en segundo plano. Todas seguian corriendo a la vez
//  (164 en el CSS), cargando la GPU y calentando celulares sin necesidad.
//
//  Aqui se pausan esas animaciones mientras su elemento esta fuera de la
//  pantalla y se reanudan al volver a verse. No toca las animaciones de
//  entrada (finitas) ni las que el propio CSS deja pausadas a proposito.
// ════════════════════════════════════════════════════════════

// Arrancan un poco antes de entrar a la vista para que no se note el cambio.
const ROOT_MARGIN = '120px'
const SWEEP_MS = 30_000

export function startOffscreenAnimationPause() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  if (!('IntersectionObserver' in window) || typeof document.getAnimations !== 'function') return () => {}

  // Elemento -> { anims: Set<Animation>, visible: boolean }
  const tracked = new Map()
  // Solo reanudamos lo que pausamos nosotros.
  const pausedByUs = new WeakSet()

  const shouldRun = (entry) => entry.visible && document.visibilityState === 'visible'

  const apply = (entry) => {
    const run = shouldRun(entry)
    entry.anims.forEach(anim => {
      try {
        if (run) {
          if (pausedByUs.has(anim) && anim.playState === 'paused') anim.play()
          pausedByUs.delete(anim)
        } else if (anim.playState === 'running') {
          anim.pause()
          pausedByUs.add(anim)
        }
      } catch { /* la animacion ya no existe */ }
    })
  }

  const forget = (el) => {
    io.unobserve(el)
    tracked.delete(el)
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      const entry = tracked.get(target)
      if (!entry) return
      if (!target.isConnected) { forget(target); return }
      // 'idle' = el CSS ya la quito (cambio de clase, etc.)
      entry.anims.forEach(anim => { if (anim.playState === 'idle') entry.anims.delete(anim) })
      if (!entry.anims.size) { forget(target); return }
      entry.visible = isIntersecting
      apply(entry)
    })
  }, { rootMargin: ROOT_MARGIN })

  const track = (anim) => {
    const target = anim?.effect?.target
    if (!target || anim.effect.getTiming?.().iterations !== Infinity) return
    let entry = tracked.get(target)
    if (!entry) {
      // Hasta que el observer responda se asume visible (no pausar de mas).
      entry = { anims: new Set(), visible: true }
      tracked.set(target, entry)
      io.observe(target)
    }
    if (entry.anims.has(anim)) return
    entry.anims.add(anim)
    apply(entry)
  }

  // Cada animacion CSS que arranca (incluye ::before/::after) pasa por aqui.
  const onAnimationStart = (event) => {
    const el = event.target
    if (!el?.getAnimations) return
    el.getAnimations({ subtree: true }).forEach(anim => {
      if (anim.animationName === event.animationName) track(anim)
    })
  }

  const onVisibility = () => tracked.forEach(apply)

  // Elementos que se quitaron del DOM estando ya fuera de pantalla no
  // disparan el observer: se limpian cada cierto tiempo.
  const sweep = window.setInterval(() => {
    tracked.forEach((_, el) => { if (!el.isConnected) forget(el) })
  }, SWEEP_MS)

  document.getAnimations().forEach(track)
  document.addEventListener('animationstart', onAnimationStart, true)
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    window.clearInterval(sweep)
    document.removeEventListener('animationstart', onAnimationStart, true)
    document.removeEventListener('visibilitychange', onVisibility)
    tracked.forEach(entry => { entry.visible = true; apply(entry) })
    io.disconnect()
    tracked.clear()
  }
}

