import { createContext, useContext, useEffect, useState } from 'react'
import { DICT } from './dictionary.js'
import { translateLegacy } from './legacyTranslations.js'

const LangContext = createContext(null)
export const useLang = () => useContext(LangContext)
const originalText = new WeakMap()
const originalAttrs = new WeakMap()

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('gg-lang') || 'es')
  useEffect(() => {
    localStorage.setItem('gg-lang', lang)
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    const visitNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.parentElement?.closest('[data-no-translate]')) return
        // Si React cambió el texto después de traducirlo, el valor nuevo es
        // el original: no volver a pintar el texto viejo encima.
        const saved = originalText.get(node)
        const source = saved && saved.written === node.nodeValue ? saved.source : node.nodeValue
        const translated = translateLegacy(source, lang)
        if (translated !== node.nodeValue) {
          originalText.set(node, { source, written: translated })
          node.nodeValue = translated
        } else if (translated === source) {
          originalText.delete(node)
        }
        return
      }
      if (!(node instanceof Element)) return
      if (node.closest('[data-no-translate]')) return
      visitAttrs(node)
      node.childNodes.forEach(visitNode)
    }

    // Solo los atributos de este elemento: un cambio de title/placeholder no
    // obliga a recorrer de nuevo todo su subárbol.
    const visitAttrs = (node) => {
      for (const attr of ['placeholder', 'title', 'aria-label']) {
        if (!node.hasAttribute(attr)) continue
        const current = node.getAttribute(attr)
        const saved = originalAttrs.get(node)?.[attr]
        const source = saved && saved.written === current ? saved.source : current
        const translated = translateLegacy(source, lang)
        if (translated !== current) {
          if (!originalAttrs.has(node)) originalAttrs.set(node, {})
          originalAttrs.get(node)[attr] = { source, written: translated }
          node.setAttribute(attr, translated)
        } else if (translated === source && saved) {
          delete originalAttrs.get(node)[attr]
        }
      }
    }

    visitNode(document.body)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(({ addedNodes, target, type }) => {
        if (type === 'characterData') visitNode(target)
        if (type === 'attributes' && !target.closest('[data-no-translate]')) visitAttrs(target)
        addedNodes.forEach(visitNode)
      })
    })
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label'],
      subtree: true,
    })
    return () => observer.disconnect()
  }, [lang])
  const t = DICT[lang]
  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

