import { useMemo, useState } from 'react'
import { zipSync, strToU8 } from 'fflate'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'

/*
 * Kit de transmision: todos los logos y fotos de jugadores de los equipos
 * inscritos, listos para los overlays (OBS, vMix...). Se puede bajar cada
 * imagen suelta o todo en un .zip con una carpeta por equipo y un CSV con
 * los nombres para fuentes de texto.
 *
 * Datos: GET /tournaments/:id/broadcast-kit (roster congelado en el
 * check-in, o el actual si el equipo aun no lo hizo; incluye equipos con
 * roster oculto porque es solo para el staff). Si ese endpoint falla (backend
 * viejo sin desplegar), respaldo: la pagina publica de cada equipo
 * (/teams/:id) o el perfil publico en inscripciones individuales -- roster
 * actual y sin fotos de equipos privados.
 */

const DEFAULT_AVATAR = '/demos/steliant-esports/avatar-default.svg'
const EXT_BY_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
}

function slug(value, fallback = 'sin-nombre') {
  const clean = String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return clean || fallback
}

const pad = (n) => String(n).padStart(2, '0')
const hasPhoto = (url) => Boolean(url) && url !== DEFAULT_AVATAR

function csvCell(value) {
  const text = String(value ?? '')
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

async function fetchImage(url) {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const type = (blob.type || '').split(';')[0].toLowerCase()
  if (!type.startsWith('image/')) throw new Error('No es una imagen')
  const fromPath = (String(url).split('?')[0].match(/\.([a-z0-9]{3,4})$/i) || [])[1]
  return { blob, ext: EXT_BY_TYPE[type] || fromPath?.toLowerCase() || 'png' }
}

function saveBlob(blob, name) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}

// Pocas a la vez para no disparar el rate limit con torneos grandes.
async function mapPool(items, size, fn) {
  const out = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
  return out
}

async function loadEntry(reg) {
  const base = {
    id: reg.id,
    name: reg.name,
    tag: reg.tag,
    logo: reg.logo || '',
    status: reg.status,
    players: [],
    note: '',
  }
  if (!reg.teamId) {
    // Inscripcion individual (1v1): el "equipo" es el jugador.
    try {
      const data = await api(`/profile/${encodeURIComponent(reg.userId)}`)
      const avatar = data?.user?.avatar || ''
      return { ...base, solo: true, players: [{ nick: reg.userNick || data?.user?.nick || reg.name, role: 'Jugador', avatar }] }
    } catch (err) {
      return { ...base, solo: true, players: [{ nick: reg.userNick || reg.name, role: 'Jugador', avatar: '' }], note: err?.status === 403 ? 'Perfil privado: sin foto.' : 'No se pudo cargar el perfil.' }
    }
  }
  try {
    const data = await api(`/teams/${encodeURIComponent(reg.teamId)}`)
    const team = data?.team || data || {}
    const roster = Array.isArray(data?.roster) ? data.roster : Array.isArray(team.roster) ? team.roster : []
    const players = roster.map(m => ({ nick: m.nick || 'Jugador', role: m.role || '', avatar: m.avatar || '' }))
    return {
      ...base,
      logo: base.logo || team.logo || '',
      players,
      note: players.length ? '' : team.showRoster === false ? 'El equipo oculta su roster.' : 'Sin jugadores en el roster.',
    }
  } catch (err) {
    return { ...base, note: err?.status === 403 ? 'Pagina del equipo privada: sin fotos de jugadores.' : 'No se pudo cargar el equipo.' }
  }
}

const SOURCE_LABEL = {
  checkin: 'Roster del check-in',
  roster: 'Roster actual (sin check-in)',
}

function entryFromKit(team) {
  const players = (team.players || []).map(p => ({ nick: p.nick || 'Jugador', role: p.captain && !/coach|manager/i.test(p.role) ? `${p.role} · Capitan` : p.role, avatar: p.avatar || '' }))
  return {
    id: team.registrationId,
    name: team.name,
    tag: team.tag,
    logo: team.logo || '',
    status: team.status,
    solo: team.source === 'individual',
    source: team.source,
    players,
    note: players.length ? '' : 'Sin jugadores en el roster.',
  }
}

async function loadAll(tournamentId, active) {
  try {
    const data = await api(`/tournaments/${encodeURIComponent(tournamentId)}/broadcast-kit`)
    if (Array.isArray(data?.teams)) return data.teams.map(entryFromKit)
  } catch {}
  return mapPool(active, 4, loadEntry)
}

export default function BroadcastKit({ t, registrations = [], loading: loadingRegs = false }) {
  const [onlyCheckedIn, setOnlyCheckedIn] = useState(false)
  const [entries, setEntries] = useState(null)
  const [loading, setLoading] = useState(false)
  const [zipping, setZipping] = useState('')
  const [zipReport, setZipReport] = useState(null)

  const pool = useMemo(() => registrations.filter(r =>
    r.status !== 'withdrawn' && r.status !== 'disqualified' && (!onlyCheckedIn || r.status === 'checked_in')
  ), [registrations, onlyCheckedIn])

  const shown = useMemo(() => {
    if (!entries) return null
    const ids = new Set(pool.map(r => r.id))
    return entries.filter(e => ids.has(e.id))
  }, [entries, pool])

  const stats = useMemo(() => {
    const list = shown || []
    const players = list.flatMap(e => e.players)
    return {
      teams: list.length,
      logos: list.filter(e => hasPhoto(e.logo)).length,
      players: players.length,
      photos: players.filter(p => hasPhoto(p.avatar)).length,
    }
  }, [shown])

  const prepare = async () => {
    setLoading(true)
    setZipReport(null)
    try {
      // Se cargan todos los activos (no solo los filtrados) para que cambiar
      // el filtro de check-in no obligue a volver a pedir todo.
      const active = registrations.filter(r => r.status !== 'withdrawn' && r.status !== 'disqualified')
      setEntries(await loadAll(t.id, active))
    } finally {
      setLoading(false)
    }
  }

  const downloadOne = async (url, name) => {
    try {
      const { blob, ext } = await fetchImage(url)
      saveBlob(blob, `${name}.${ext}`)
    } catch {
      // Sin CORS (imagen de otro sitio): al menos abrirla para guardarla a mano.
      window.open(url, '_blank', 'noopener')
    }
  }

  const downloadZip = async () => {
    if (!shown?.length) return
    const files = {}
    const missing = []
    const rows = [['n', 'equipo', 'tag', 'jugador', 'rol', 'logo', 'foto']]
    const jobs = []

    shown.forEach((entry, i) => {
      const folder = `${pad(i + 1)}-${slug(entry.tag || entry.name)}`
      const teamLabel = entry.tag ? `${entry.name} [${entry.tag}]` : entry.name
      const logoRef = { path: '' }
      if (hasPhoto(entry.logo)) jobs.push({ url: entry.logo, base: `${folder}/logo`, ref: logoRef, label: `${teamLabel}: logo` })
      else missing.push(`${teamLabel}: sin logo`)
      if (entry.note) missing.push(`${teamLabel}: ${entry.note}`)
      if (!entry.players.length) rows.push([i + 1, entry.name, entry.tag, '', '', logoRef, ''])
      entry.players.forEach((p, j) => {
        const photoRef = { path: '' }
        if (hasPhoto(p.avatar)) jobs.push({ url: p.avatar, base: `${folder}/jugadores/${pad(j + 1)}-${slug(p.nick)}`, ref: photoRef, label: `${teamLabel}: foto de ${p.nick}` })
        else missing.push(`${teamLabel}: ${p.nick} no tiene foto`)
        rows.push([i + 1, entry.name, entry.tag, p.nick, p.role, logoRef, photoRef])
      })
    })

    let done = 0
    setZipping(`0/${jobs.length}`)
    try {
      await mapPool(jobs, 6, async job => {
        try {
          const { blob, ext } = await fetchImage(job.url)
          job.ref.path = `${job.base}.${ext}`
          files[job.ref.path] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }]
        } catch (err) {
          missing.push(`${job.label}: no se pudo descargar (${err.message}) -> ${job.url}`)
        }
        done += 1
        setZipping(`${done}/${jobs.length}`)
      })

      const csv = rows
        .map(row => row.map(cell => csvCell(typeof cell === 'object' && cell ? cell.path : cell)).join(','))
        .join('\r\n')
      // BOM para que Excel abra bien acentos y ñ.
      files['roster.csv'] = strToU8(`﻿${csv}\r\n`)
      files['LEEME.txt'] = strToU8([
        `Kit de transmision - ${t.title || t.name || 'Torneo'}`,
        `Generado: ${new Date().toLocaleString()}`,
        '',
        'Una carpeta por equipo (en el orden de la lista): logo + jugadores/.',
        'roster.csv tiene equipo, jugador, rol y la ruta de cada imagen,',
        'para fuentes de texto o "data merge" en el programa de overlays.',
        '',
        missing.length ? `FALTANTES (${missing.length}):` : 'No falta ninguna imagen.',
        ...missing.map(line => `- ${line}`),
        '',
      ].join('\r\n'))

      const zipped = zipSync(files)
      saveBlob(new Blob([zipped], { type: 'application/zip' }), `kit-transmision-${slug(t.title || t.name || 'torneo')}.zip`)
      setZipReport({ ok: jobs.length - missing.filter(m => m.includes('no se pudo descargar')).length, missing })
    } finally {
      setZipping('')
    }
  }

  return (
    <div className="otm-section otm-kit">
      <div className="otm-panel__head" style={{ marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0 }}>{Icon.tv} Kit de transmision</h3>
          <p className="otm-muted" style={{ margin: '6px 0 0' }}>
            Logos y fotos de todos los jugadores para los overlays. Baja cada imagen o todo junto en un .zip (una carpeta por equipo + CSV con los nombres).
          </p>
        </div>
        <div className="otm-kit__actions">
          <label className="otm-kit__check">
            <input type="checkbox" checked={onlyCheckedIn} onChange={e => setOnlyCheckedIn(e.target.checked)} />
            Solo con check-in
          </label>
          <button type="button" className="otm-btn otm-btn--ghost otm-btn--xs" onClick={prepare} disabled={loading || loadingRegs || !pool.length}>
            {Icon.refresh} {loading ? 'Cargando...' : entries ? 'Actualizar' : 'Preparar kit'}
          </button>
          {entries && (
            <button type="button" className="otm-btn otm-btn--primary otm-btn--xs" onClick={downloadZip} disabled={Boolean(zipping) || !shown?.length}>
              {Icon.download} {zipping ? `Descargando ${zipping}` : 'Descargar todo (.zip)'}
            </button>
          )}
        </div>
      </div>

      {!entries ? (
        <p className="otm-muted" style={{ margin: 0 }}>
          {loadingRegs
            ? 'Cargando equipos inscritos...'
            : pool.length
              ? `${pool.length} equipo(s) listos. Dale a "Preparar kit" para ver logos y fotos.`
              : onlyCheckedIn && registrations.length
                ? 'Ningun equipo ha hecho check-in todavia.'
                : 'Todavia no hay equipos inscritos. Cuando se inscriban, aqui vas a poder bajar sus logos y las fotos de los jugadores.'}
        </p>
      ) : (
        <>
          <div className="otm-kit__stats">
            <span><b>{stats.teams}</b> equipos</span>
            <span className={stats.logos < stats.teams ? 'is-warn' : ''}><b>{stats.logos}/{stats.teams}</b> logos</span>
            <span className={stats.photos < stats.players ? 'is-warn' : ''}><b>{stats.photos}/{stats.players}</b> fotos de jugadores</span>
          </div>

          {zipReport && (
            <p className={`otm-kit__report${zipReport.missing.length ? ' is-warn' : ''}`}>
              {zipReport.missing.length
                ? `Zip listo con ${zipReport.ok} imagen(es). Faltan ${zipReport.missing.length}: la lista esta en LEEME.txt dentro del zip.`
                : `Zip listo con ${zipReport.ok} imagen(es). No falta ninguna.`}
            </p>
          )}

          <div className="otm-kit__teams">
            {shown.map((entry, i) => (
              <div key={entry.id} className="otm-kit__team">
                <div className="otm-kit__team-hd">
                  <span className="otm-kit__n">{pad(i + 1)}</span>
                  <button
                    type="button"
                    className={`otm-kit__logo${hasPhoto(entry.logo) ? '' : ' is-missing'}`}
                    title={hasPhoto(entry.logo) ? 'Descargar logo' : 'Este equipo no tiene logo'}
                    disabled={!hasPhoto(entry.logo)}
                    onClick={() => downloadOne(entry.logo, `${pad(i + 1)}-${slug(entry.tag || entry.name)}-logo`)}
                  >
                    {hasPhoto(entry.logo) ? <img src={entry.logo} alt="" /> : <span>{String(entry.tag || entry.name || 'GG').slice(0, 2).toUpperCase()}</span>}
                    {hasPhoto(entry.logo) && <i>{Icon.download}</i>}
                  </button>
                  <div className="otm-kit__team-info">
                    <b>{entry.name}</b>
                    <span>{entry.tag ? `[${entry.tag}] · ` : ''}{entry.solo ? 'Individual' : `${entry.players.length} jugador(es)`}{entry.status === 'checked_in' ? ' · Check-in OK' : ''}{SOURCE_LABEL[entry.source] ? ` · ${SOURCE_LABEL[entry.source]}` : ''}</span>
                    {entry.note && <em>{Icon.alert} {entry.note}</em>}
                  </div>
                </div>
                {entry.players.length > 0 && (
                  <div className="otm-kit__players">
                    {entry.players.map((p, j) => (
                      <button
                        key={`${p.nick}-${j}`}
                        type="button"
                        className={`otm-kit__player${hasPhoto(p.avatar) ? '' : ' is-missing'}`}
                        title={hasPhoto(p.avatar) ? `Descargar foto de ${p.nick}` : `${p.nick} no tiene foto`}
                        disabled={!hasPhoto(p.avatar)}
                        onClick={() => downloadOne(p.avatar, `${slug(entry.tag || entry.name)}-${slug(p.nick)}`)}
                      >
                        <span className="otm-kit__photo">
                          {hasPhoto(p.avatar) ? <img src={p.avatar} alt="" loading="lazy" /> : <span>Sin foto</span>}
                        </span>
                        <b>{p.nick}</b>
                        {p.role && <small>{p.role}</small>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

