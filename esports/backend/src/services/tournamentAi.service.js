import { generate } from './ai.service.js'
import { DEFAULT_KNOWLEDGE_BASE, tournamentContext } from './knowledgeBase.js'

/**
 * Capa de IA específica de torneos: usa el cerebro multi-proveedor
 * (ai.service) pero inyecta el "manual" + el contexto del torneo para
 * que las respuestas estén ancladas a la realidad del evento.
 */

const PERSONA = `Eres "GlitchGang Bot", el asistente oficial de torneos de la plataforma GlitchGang.
Respondes a jugadores y organizadores por WhatsApp y Discord.
Tono: claro, breve, amistoso y profesional. Responde en español.
Reglas:
- Apóyate SOLO en la guía y el contexto del torneo proporcionados.
- Si la respuesta no está en el material, dilo y sugiere usar /ayuda o contactar a la organización. No inventes reglas, fechas ni premios.
- Cuando sea útil, menciona el comando exacto (ej: /checkin).
- Mensajes cortos, aptos para chat (evita párrafos largos).`

/** Responde una duda de un jugador, anclada al torneo y a la guía. */
export async function answerQuestion({ tournament, question, history = [], knowledgeBase }) {
  const system = [
    PERSONA,
    '\n=== GUÍA DEL SISTEMA ===\n' + (knowledgeBase || DEFAULT_KNOWLEDGE_BASE),
    '\n=== CONTEXTO DEL TORNEO ===\n' + tournamentContext(tournament),
  ].join('\n')

  const messages = [
    ...history.slice(-6).map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content || '') })),
    { role: 'user', content: question },
  ]
  return generate({ system, messages })
}

/** Redacta un aviso/anuncio corto para difundir por WhatsApp o Discord. */
export async function draftAnnouncement({ tournament, kind = 'general', details = '', channel = 'whatsapp' }) {
  const system = [
    PERSONA,
    `Tarea: redactar UN aviso de tipo "${kind}" para difundir por ${channel}.`,
    'Formato: 1-3 líneas, directo, con emoji moderado. No incluyas explicaciones, solo el mensaje listo para enviar.',
    '\n=== CONTEXTO DEL TORNEO ===\n' + tournamentContext(tournament),
  ].join('\n')

  const messages = [{
    role: 'user',
    content: `Redacta el aviso. Detalles a incluir: ${details || '(usa el contexto del torneo)'}`,
  }]
  return generate({ system, messages, maxTokens: 300 })
}
