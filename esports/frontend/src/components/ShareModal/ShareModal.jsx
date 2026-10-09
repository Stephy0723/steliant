import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../icons/Icons.jsx'
import { api } from '../../lib/api.js'
import { toast } from '../../lib/toast.js'
import { useNotifications } from '../../context/NotificationsContext.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { getAllCommunities } from '../../data/communities.js'
import './ShareModal.css'

function cleanShareTitle(value = '') {
  return String(value || 'GlitchGang').replace(/^Compartir\s+/i, '').trim() || 'GlitchGang'
}

function buildShareMessage({ text, title, game, summary, url, lang = 'es' }) {
  const cleanTitle = cleanShareTitle(title)
  const copy = lang === 'es'
    ? {
        intro: `Te invito a revisar ${cleanTitle} en GlitchGang.`,
        game: 'Juego',
        open: 'Abrir enlace',
      }
    : {
        intro: `Check out ${cleanTitle} on GlitchGang.`,
        game: 'Game',
        open: 'Open link',
      }

  return [
    text || copy.intro,
    game ? `${copy.game}: ${game}` : '',
    summary,
    url ? `${copy.open}: ${url}` : '',
  ].filter(Boolean).join('\n')
}

function contactInitials(name = 'GG') {
  return String(name).trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'GG'
}

const SHARE_CHANNELS = [
  { id: 'friends', labelEs: 'Amigos', labelEn: 'Friends', icon: Icon.friends || Icon.users },
  { id: 'chats', labelEs: 'Chats', labelEn: 'Chats', icon: Icon.msg },
  { id: 'teams', labelEs: 'Equipos', labelEn: 'Teams', icon: Icon.team || Icon.users },
  { id: 'communities', labelEs: 'Comunidades', labelEn: 'Communities', icon: Icon.globe || Icon.chat },
]

const FALLBACK_CHATS = [
  { id: 'team-chat', name: 'Chat de equipo', subtitle: 'Canal competitivo', initials: 'EQ', kind: 'chat' },
  { id: 'support-chat', name: 'Soporte GlitchGang', subtitle: 'Canal de asistencia', initials: 'GG', kind: 'chat' },
]

function normalizeDestination(item, kind) {
  const id = String(item.id || item.slug || item.name || `${kind}-${Math.random()}`)
  return {
    id,
    key: `${kind}:${id}`,
    kind,
    name: item.name || item.nick || item.title || 'Destino',
    subtitle: item.subtitle || item.genre || item.game || item.description || '',
    avatar: item.avatar || item.logo || item.image || item.poster || '',
    logo: item.logo || item.avatar || '',
    cover: item.cover || item.banner || item.image || item.poster || '',
    initials: item.initials || contactInitials(item.name || item.nick || item.title),
  }
}

function chatIdForDestination(destination) {
  if (destination.kind === 'chat') return destination.id
  if (destination.kind === 'friend') return `friend-${destination.id}`
  if (destination.kind === 'team') return 'team-chat'
  if (destination.kind === 'community') return `community-${destination.id}`
  return `share-${destination.kind}-${destination.id}`
}

function channelForDestination(destination) {
  if (destination.kind === 'friend') return 'friends'
  if (destination.kind === 'team') return 'team'
  if (destination.kind === 'community') return 'community'
  return 'support'
}

function sectionForDestination(destination) {
  if (destination.kind === 'friend') return 'friends'
  if (destination.kind === 'team') return 'team'
  if (destination.kind === 'community') return 'community'
  return 'system'
}

function buildShareChat(destination, payload) {
  return {
    id: chatIdForDestination(destination),
    section: sectionForDestination(destination),
    channel: channelForDestination(destination),
    name: destination.kind === 'team' ? 'Chat de equipo' : destination.name,
    subtitle: destination.subtitle || payload.game || 'Invitacion compartida',
    initials: destination.initials,
    image: destination.avatar,
    cover: destination.cover || destination.avatar,
    color: 'var(--accent)',
    unread: 0,
    members: destination.kind === 'friend' ? [destination.name, 'Tu'] : [destination.name],
    description: `Invitaciones y mensajes compartidos con ${destination.name}.`,
    messages: [],
  }
}

function persistShareToMessenger(destinations, payload) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('gg-messenger-share', { detail: { destinations, payload } }))
}

export default function ShareModal({
  open,
  onClose,
  title = 'Compartir',
  subtitle = 'Comparte este enlace con tu comunidad o con contactos directos.',
  url = '',
  text = '',
  game = '',
  summary = '',
  image = '',
  logo = '',
  contacts = [],
  chats = [],
  teams = [],
  communities = [],
  shareKind = 'invite',
  onShareToContacts,
  onShareToDestinations,
}) {
  const notifications = useNotifications()
  const { lang } = useLang()
  const isEs = lang === 'es'
  const [selectedContacts, setSelectedContacts] = useState([])
  const [activeChannel, setActiveChannel] = useState('friends')
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const isInvite = shareKind !== 'post'

  const shareUrl = useMemo(() => {
    if (url) return url
    if (typeof window !== 'undefined') return window.location.href
    return ''
  }, [url])
  const displayTitle = useMemo(() => cleanShareTitle(title), [title])
  const shareMessage = useMemo(() => buildShareMessage({ text, title: displayTitle, game, summary, url: shareUrl, lang }), [displayTitle, game, lang, shareUrl, summary, text])
  const destinationGroups = useMemo(() => {
    const communityItems = communities.length
      ? communities
      : getAllCommunities().filter(item => item.joined).slice(0, 8)
    const chatItems = chats.length ? chats : FALLBACK_CHATS
    return {
      friends: contacts.map(item => normalizeDestination(item, 'friend')),
      chats: chatItems.map(item => normalizeDestination(item, 'chat')),
      teams: teams.map(item => normalizeDestination(item, 'team')),
      communities: communityItems.map(item => normalizeDestination(item, 'community')),
    }
  }, [chats, communities, contacts, teams])

  const activeDestinations = destinationGroups[activeChannel] || []
  const selectedDestinations = useMemo(
    () => Object.values(destinationGroups).flat().filter(item => selectedContacts.includes(item.key)),
    [destinationGroups, selectedContacts],
  )

  async function copyLink(value = shareUrl, message = 'Enlace copiado.') {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast(message)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast('No se pudo copiar.', 'error')
    }
  }

  async function nativeShare() {
    if (!navigator.share) {
      await copyLink(shareMessage, 'Mensaje copiado para compartir.')
      return
    }

    try {
      await navigator.share({ title: displayTitle, text: shareMessage, url: shareUrl })
      toast(isEs ? 'Mensaje listo para compartir.' : 'Share message ready.')
    } catch {}
  }

  function toggleContact(contactId) {
    setSelectedContacts(current => (
      current.includes(contactId)
        ? current.filter(id => id !== contactId)
        : [...current, contactId]
    ))
  }

  async function sendToContacts() {
    if (!selectedDestinations.length) {
      toast('Selecciona al menos un destino.', 'warn')
      return
    }

    setSending(true)
    try {
      const payload = { url: shareUrl, message: shareMessage, title: displayTitle, summary, game, image, logo }
      if (onShareToDestinations) {
        await onShareToDestinations(selectedDestinations, payload)
      } else if (onShareToContacts) {
        await onShareToContacts(selectedDestinations.map(item => item.id), shareUrl)
      } else {
        await api('/messages/share', {
          method: 'POST',
          body: { destinations: selectedDestinations, payload, shareKind },
        })
      }
      persistShareToMessenger(selectedDestinations, payload)

      const names = selectedDestinations.map(item => item.name).join(', ')
      notifications?.pushNotification?.({
        type: 'mensaje',
        category: 'equipos',
        tone: 'success',
        toneColor: 'var(--accent)',
        title: `${isInvite ? 'Invitacion enviada' : 'Publicacion compartida'}: ${displayTitle}`,
        desc: `Compartiste ${isInvite ? 'la invitacion' : 'la publicacion'} con ${names}.`,
        fullMessage: `${shareMessage}\n\nDestinos: ${names}`,
        from: 'GlitchGang Mensajeria',
        action: { label: isInvite ? 'Abrir invitacion' : 'Abrir publicacion', link: shareUrl },
        entity: { title: displayTitle, subtitle: game || 'GlitchGang', image: image || logo || '', url: shareUrl },
        meta: [
          { label: 'Destinos', value: String(selectedDestinations.length) },
          { label: 'Tipo', value: isInvite ? 'Invitacion interna' : 'Publicacion interna' },
        ],
      })
      toast(`${isInvite ? 'Invitacion enviada' : 'Publicacion compartida'} a ${selectedDestinations.length} destino${selectedDestinations.length === 1 ? '' : 's'}.`)
      setSelectedContacts([])
      onClose?.()
    } catch {
      toast('No se pudo enviar la invitacion.', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="gg-share-modal"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.article
            className="gg-share-card"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={displayTitle}
          >
            <div className="gg-share-card__in">
              <div className="gg-share-card__scan" />
              <button className="gg-share-card__close" type="button" onClick={onClose} aria-label="Cerrar">
                {Icon.x}
              </button>

              <header className="gg-share-card__header">
                <span className="gg-share-card__badge">{Icon.share}</span>
                <div>
                  <i>{isEs ? 'Compartir' : 'Share'}</i>
                  <h2>{isEs ? `Compartir ${displayTitle}` : `Share ${displayTitle}`}</h2>
                  <p>{subtitle}</p>
                </div>
              </header>

              <section className="gg-share-banner" style={{ '--share-image': image ? `url(${image})` : 'none' }}>
                <div className="gg-share-banner__media">
                  {image && <img src={image} alt="" />}
                  <span className="gg-share-banner__logo">
                    {logo ? <img src={logo} alt="" /> : Icon.share}
                  </span>
                </div>
                <div className="gg-share-banner__copy">
                  <span>{game || 'GlitchGang'}</span>
                  <b>{displayTitle}</b>
                  <p>{summary || (isEs ? (isInvite ? 'Invitacion compartida desde GlitchGang.' : 'Publicacion compartida desde GlitchGang.') : (isInvite ? 'Invitation shared from GlitchGang.' : 'Post shared from GlitchGang.'))}</p>
                </div>
              </section>

              <section className="gg-share-section">
                <div className="gg-share-section__label">
                  <span>{Icon.share}</span>
                  <b>{isEs ? 'Comparte el enlace' : 'Share the link'}</b>
                </div>
                <div className="gg-share-link">
                  <input value={shareUrl} readOnly aria-label={isEs ? 'Enlace para compartir' : 'Share link'} />
                  <button type="button" onClick={() => copyLink()} aria-label="Copiar enlace">
                    {copied ? Icon.check : Icon.copy || Icon.fileText}
                  </button>
                </div>
                <button className="gg-share-native" type="button" onClick={nativeShare}>
                  {Icon.send} {isEs ? 'Compartir mensaje completo' : 'Share full message'}
                </button>
              </section>

              <section className="gg-share-section">
                <div className="gg-share-section__label">
                  <span>{Icon.send}</span>
                  <b>{isEs ? 'Enviar dentro de GlitchGang' : 'Send inside GlitchGang'}</b>
                </div>
                <div className="gg-share-tabs" role="tablist" aria-label="Destino para compartir">
                  {SHARE_CHANNELS.map(channel => (
                    <button
                      key={channel.id}
                      type="button"
                      className={activeChannel === channel.id ? 'active' : ''}
                      onClick={() => setActiveChannel(channel.id)}
                    >
                      {channel.icon}
                      <span>{isEs ? channel.labelEs : channel.labelEn}</span>
                      {destinationGroups[channel.id]?.length ? <i>{destinationGroups[channel.id].length}</i> : null}
                    </button>
                  ))}
                </div>
                {activeDestinations.length ? (
                  <>
                    <div className="gg-share-contacts">
                      {activeDestinations.slice(0, 12).map(contact => {
                        const selected = selectedContacts.includes(contact.key)
                        return (
                          <button
                            type="button"
                            className={`gg-share-contact${selected ? ' selected' : ''}`}
                            key={contact.key}
                            onClick={() => toggleContact(contact.key)}
                          >
                            <span>
                              {contact.avatar ? <img src={contact.avatar} alt="" /> : contact.initials}
                              {selected && <i>{Icon.check}</i>}
                            </span>
                            <small>{contact.name}</small>
                            {contact.subtitle && <em>{contact.subtitle}</em>}
                          </button>
                        )
                      })}
                    </div>
                    <button className="gg-share-send" type="button" onClick={sendToContacts} disabled={sending}>
                      {Icon.send} {sending ? (isEs ? 'Enviando...' : 'Sending...') : `${isEs ? (isInvite ? 'Enviar invitacion' : 'Enviar publicacion') : (isInvite ? 'Send invitation' : 'Send post')}${selectedDestinations.length ? ` (${selectedDestinations.length})` : ''}`}
                    </button>
                  </>
                ) : (
                  <div className="gg-share-empty">
                    <span>{Icon.users}</span>
                    <p>{isEs ? 'No hay destinos disponibles en esta categoría. Prueba otra pestaña o copia el enlace.' : 'No destinations available in this category yet. Try another tab or copy the link.'}</p>
                  </div>
                )}
              </section>
            </div>
          </motion.article>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

