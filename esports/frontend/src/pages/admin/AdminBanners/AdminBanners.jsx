import { useState, useRef, useEffect } from 'react'
import { safeHref } from '../../../lib/safeUrl.js'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import { toast } from '../../../lib/toast.js'
import { api } from '../../../lib/api.js'
import {
  getSiteAds, createSiteAd, updateSiteAd, deleteSiteAd, reorderSiteAds,
  getSitePromos, createSitePromo, updateSitePromo, deleteSitePromo,
} from '../../../lib/siteAdsApi.js'
import { uploadFile } from '../../../lib/uploadsApi.js'
import { GAMES } from '../../../data/games.js'
import { useAdsVisibility } from '../../../context/AdsVisibilityContext.jsx'
import { setAdSlotVisibility } from '../../../lib/adsSettingsApi.js'
import './AdminBanners.css'

const SLOTS = [
  { id: 'all',        label: 'Todos',          icon: Icon.layoutGrid, color: 'var(--text-dim)' },
  { id: 'banner',     label: 'Banner Hero',    icon: Icon.tv,         color: '#00E676' },
  { id: 'tournament', label: 'Strip Torneos',  icon: Icon.trophy,     color: '#f59e0b' },
  { id: 'floating',   label: 'Flotante',       icon: Icon.bolt,       color: '#7c3aed' },
  { id: 'dashboard',  label: 'Panel Jugador',  icon: Icon.layoutGrid, color: '#06B6D4' },
  { id: 'promo',      label: 'Modal Promo',    icon: Icon.star,       color: '#ec4899' },
]
const SLOT_META = {
  banner:     { label: 'Banner Hero',    color: '#00E676', desc: 'Carrusel hero en /torneos' },
  tournament: { label: 'Strip Torneos',  color: '#f59e0b', desc: 'Banda debajo de los filtros en /torneos' },
  floating:   { label: 'Toast Flotante', color: '#7c3aed', desc: 'Toast esquina inferior-derecha (aparece 3s después de entrar)' },
  dashboard:  { label: 'Panel Jugador',  color: '#06B6D4', desc: 'Strip de patrocinador en el dashboard del jugador' },
  promo:      { label: 'Modal Promo',    color: '#ec4899', desc: 'Overlay interstitial con cuenta regresiva (15s)' },
}
const TYPE_LABELS = { tournament:'Torneo', team:'Equipo', event:'Evento', creator:'Creador', brand:'Marca', profile:'Perfil' }
const TYPE_COLORS = { tournament:'#00E676', team:'#7c3aed', event:'#f59e0b', creator:'#ec4899', brand:'#3b82f6', profile:'#8b5cf6' }
const GAME_PREFIX = { val:'VAL', lol:'LOL', cs2:'CS2', apex:'APX', rl:'RKL', ff:'FRF', mlbb:'MLB', dota:'DTA' }
const seq3 = () => String(Math.floor(Math.random() * 900) + 100)
const genUid = ({ game, type, teamTag, title } = {}) => {
  if (game) return `${GAME_PREFIX[game] || game.slice(0,3).toUpperCase()}-${seq3()}`
  if (type === 'team' && teamTag) return `TM-${teamTag.toUpperCase()}-${seq3()}`
  if ((type === 'brand' || type === 'sponsor') && title) {
    const words = title.trim().split(/\s+/)
    const pfx = (words.length === 1 ? title.slice(0,4) : words.map(w=>w[0]).join('')).toUpperCase().slice(0,4)
    return `SPO-${pfx}-${seq3()}`
  }
  return 'AD-' + Math.random().toString(36).slice(2,8).toUpperCase()
}
const fmtDate = d => { if (!d) return ''; try { return new Date(d + 'T12:00:00').toLocaleDateString('es-DO', { day:'2-digit', month:'short', year:'numeric' }) } catch { return d } }
const BLANK_AD = {
  slot:'banner', active:true, type:'custom',
  title:'', uid:'', badge:'', description:'', game:'', teamTag:'',
  imageUrl:'', color1:'#7c3aed', color2:'#0e1118', textColor:'#fff',
  btnText:'Ver más', btnUrl:'', live:false, prize:'', scheduledDate:'',
}

/* ─── AdEditor ─────────────────────────────────────────────────── */
function AdEditor({ ad, saving, onSave, onCancel }) {
  // Equipos reales para anunciar (antes: ranking de ejemplo de data/teams.js).
  const [teams, setTeams] = useState([])
  useEffect(() => {
    api('/admin/teams').then(res => setTeams((res.teams || []).filter(t => t.status !== 'Eliminado' && t.tag))).catch(() => setTeams([]))
  }, [])
  const [form, setForm] = useState(() => ({ ...BLANK_AD, ...ad, uid: ad?.uid || genUid() }))
  const [preview, setPreview] = useState(ad?.imageUrl || '')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()
  const isNew = !ad?.id
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Auto-regenerate uid when context changes (only for new ads or when context shifts)
  useEffect(() => {
    if (!isNew) return
    const uid = genUid({ game: form.game, type: form.type, teamTag: form.teamTag, title: form.title })
    setForm(f => ({ ...f, uid }))
  }, [form.game, form.type, form.teamTag])
  const handleFile = async e => {
    const file = e.target.files?.[0]; if (!file) return
    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)
    setUploading(true)
    try {
      const { url } = await uploadFile(file)
      set('imageUrl', url)
    } catch {
      toast('No se pudo subir la imagen', 'error')
      setPreview(form.imageUrl || '')
    } finally {
      setUploading(false)
    }
  }
  return (
    <motion.div className="ab-editor-overlay" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <motion.div className="ab-editor-modal" initial={{ scale:0.94, y:20 }} animate={{ scale:1, y:0 }} exit={{ scale:0.94, y:20 }}
        transition={{ duration:0.28, ease:[0.22,1,0.36,1] }}>

        <div className="ab-editor-head">
          <div>
            <h3>{ad?.id ? 'Editar anuncio' : 'Nuevo anuncio'}</h3>
            <p>Configura imagen, textos, colores y dónde aparece</p>
          </div>
          <button className="ab-editor-close" onClick={onCancel}>{Icon.x}</button>
        </div>

        <div className="ab-live-preview" style={{ '--pc1': form.color1, '--pc2': form.color2 }}>
          <span className="ab-live-preview__label">{Icon.eye} PREVIEW</span>
          {preview && <img src={preview} alt="" />}
          <div className="ab-live-preview__scrim" />
          <div className="ab-live-preview__content" style={{ color: form.textColor }}>
            {form.uid && <small style={{ fontFamily:'monospace', letterSpacing:'.05em' }}>{form.uid}</small>}
            <b>{form.title || 'Título del anuncio'}</b>
            {form.description && <p>{form.description.slice(0,55)}{form.description.length>55?'...':''}</p>}
            {form.btnText && <span className="ab-live-preview__btn" style={{ background:form.color1, color:form.textColor }}>{form.btnText}</span>}
          </div>
          <div className="ab-live-preview__bar" />
        </div>

        <div className="ab-editor-body">
          <div className="ab-ef-section">
            <label className="ab-ef-label">¿Dónde aparece este anuncio?</label>
            <div className="ab-slot-pills">
              {SLOTS.filter(s => s.id !== 'all').map(s => (
                <button key={s.id} type="button"
                  className={`ab-slot-pill ${form.slot === s.id ? 'active' : ''}`}
                  style={{ '--sp': s.color }} onClick={() => set('slot', s.id)}>
                  <span className="ab-slot-pill__icon">{s.icon}</span>
                  <span className="ab-slot-pill__info">
                    <b>{s.label}</b>
                    <small>{SLOT_META[s.id].desc}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="ab-ef-section">
            <label className="ab-ef-label">Contexto del anuncio</label>
            <div className="ab-type-grid">
              {[
                {id:'tournament',label:'Torneo',icon:Icon.trophy},
                {id:'team',label:'Equipo',icon:Icon.users},
                {id:'brand',label:'Patrocinio',icon:Icon.star},
                {id:'event',label:'Evento',icon:Icon.bolt},
                {id:'creator',label:'Creador',icon:Icon.user},
                {id:'custom',label:'Libre',icon:Icon.edit},
              ].map(t => (
                <button key={t.id} type="button"
                  className={`ab-type-btn ${form.type===t.id?'active':''}`}
                  style={{'--tc':TYPE_COLORS[t.id]||'var(--accent)'}}
                  onClick={() => set('type', t.id)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {['tournament','event','custom','platform'].includes(form.type) && (
              <div style={{marginTop:12}}>
                <p className="ab-ctx-sublabel">Juego <small>(define el prefijo del ID)</small></p>
                <div className="ab-game-picker">
                  <button type="button"
                    className={`ab-game-btn ${!form.game?'active':''}`}
                    onClick={() => set('game', '')}>
                    Ninguno
                  </button>
                  {GAMES.map(g => (
                    <button key={g.id} type="button"
                      className={`ab-game-btn ${form.game===g.id?'active':''}`}
                      style={{'--gc':g.color}}
                      onClick={() => set('game', g.id)}>
                      <span className="ab-game-dot" style={{background:g.color}} />
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.type === 'team' && (
              <div style={{marginTop:12}}>
                <p className="ab-ctx-sublabel">Equipo <small>(el tag genera el ID)</small></p>
                <div className="ab-game-picker">
                  {teams.length === 0 && <small className="ab-ctx-sublabel">No hay equipos registrados.</small>}
                  {teams.map(tm => (
                    <button key={tm.id} type="button"
                      className={`ab-game-btn ${form.teamTag===tm.tag?'active':''}`}
                      style={{'--gc':tm.color || 'var(--accent)'}}
                      onClick={() => set('teamTag', form.teamTag===tm.tag?'':tm.tag)}>
                      <span className="ab-game-dot" style={{background:tm.color || 'var(--accent)'}} />
                      <b>{tm.tag}</b> · {tm.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="ab-ef-section">
            <label className="ab-ef-label">Imagen de fondo</label>
            <div className="ab-img-row">
              <div className={`ab-img-box ${preview ? 'has' : ''}`} onClick={() => !uploading && fileRef.current?.click()}>
                {uploading
                  ? <small>Subiendo…</small>
                  : preview ? <img src={preview} alt="" /> : <><span>{Icon.upload}</span><small>Subir imagen</small></>}
              </div>
              <div className="ab-img-url-col">
                <input placeholder="O pega URL de imagen..."
                  value={form.imageUrl.startsWith('blob:') ? '' : form.imageUrl}
                  onChange={e => { set('imageUrl', e.target.value); setPreview(e.target.value) }} />
                <small>Recomendado: 1200×630 px · JPG, PNG o WebP</small>
                {preview && <button className="ab-img-clear" onClick={() => { setPreview(''); set('imageUrl','') }}>{Icon.trash} Quitar imagen</button>}
              </div>
              <input type="file" accept="image/*" ref={fileRef} style={{ display:'none' }} onChange={handleFile} />
            </div>
          </div>

          <div className="ab-ef-section">
            <label className="ab-ef-label">Textos</label>
            <div className="ab-form-grid">
              <div className="ab-field"><label>Título *</label>
                <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="GG INVITATIONAL" /></div>
              <div className="ab-field ab-field--uid"><label>ID Único</label>
                <div className="ab-uid-row">
                  <code className="ab-uid-code">{form.uid}</code>
                  <button type="button" className="ab-ghost-btn"
                    onClick={() => set('uid', genUid({ game:form.game, type:form.type, teamTag:form.teamTag, title:form.title }))}>
                    {Icon.refresh} Regenerar
                  </button>
                </div>
              </div>
              <div className="ab-field"><label>Badge / Etiqueta</label>
                <input value={form.badge} onChange={e => set('badge', e.target.value)} placeholder="INVITATIONAL" /></div>
              <div className="ab-field"><label>Premio (opcional)</label>
                <input value={form.prize} onChange={e => set('prize', e.target.value)} placeholder="$10,000" /></div>
            </div>
            <div className="ab-field" style={{ marginTop:10 }}>
              <label>Descripción</label>
              <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Descripción corta..." />
            </div>
            <div className="ab-field" style={{ marginTop:10 }}>
              <label>Fecha del evento</label>
              <input type="date" value={form.scheduledDate} onChange={e => set('scheduledDate', e.target.value)} />
            </div>
          </div>

          <div className="ab-ef-section">
            <label className="ab-ef-label">Botón de acción</label>
            <div className="ab-form-grid">
              <div className="ab-field"><label>Texto del botón</label>
                <input value={form.btnText} onChange={e => set('btnText', e.target.value)} placeholder="VER DETALLES" /></div>
              <div className="ab-field"><label>URL de destino</label>
                <input value={form.btnUrl} onChange={e => set('btnUrl', e.target.value)} placeholder="/torneos/3 o https://..." /></div>
            </div>
          </div>

          <div className="ab-ef-section">
            <label className="ab-ef-label">Colores</label>
            <div className="ab-form-grid ab-form-grid--3">
              {[['color1','Color principal'],['color2','Color fondo'],['textColor','Color texto']].map(([k,lbl]) => (
                <div key={k} className="ab-field"><label>{lbl}</label>
                  <div className="ab-color-row">
                    <input type="color" value={form[k]} onChange={e => set(k, e.target.value)} />
                    <code>{form[k]}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ab-ef-opts">
            <label className="ab-toggle">
              <span className={`ab-toggle__knob ${form.live ? 'on' : ''}`} onClick={() => set('live', !form.live)} />
              <span>Marcar como EN VIVO</span>
            </label>
            <label className="ab-toggle">
              <span className={`ab-toggle__knob ${form.active ? 'on' : ''}`} onClick={() => set('active', !form.active)} />
              <span>{form.active ? 'Activo — visible en plataforma' : 'Oculto — no visible'}</span>
            </label>
          </div>
        </div>

        <div className="ab-editor-foot">
          <button className="ab-btn" onClick={onCancel}>{Icon.x} Cancelar</button>
          <button className="ab-save-btn" disabled={!form.title.trim() || uploading || saving} onClick={() => onSave(form)}>
            {Icon.check} {saving ? 'Guardando…' : 'Guardar anuncio'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─── AdCard ──────────────────────────────────────────────────── */
function AdCard({ ad, onEdit, onToggle, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  const meta = SLOT_META[ad.slot] || {}
  const [confirmDel, setConfirmDel] = useState(false)
  return (
    <motion.div className={`ab-ad-card ${ad.active ? '' : 'ab-ad-card--off'}`}
      style={{ '--ac': meta.color || 'var(--accent)' }} layout>
      <div className="ab-ad-card__thumb">
        {ad.imageUrl
          ? <img src={ad.imageUrl} alt={ad.title} />
          : <div className="ab-ad-card__no-img" style={{ background: ad.color1||'var(--accent)' }}>{ad.title?.charAt(0)}</div>}
        <div className="ab-ad-card__thumb-bar" style={{ background: ad.color1 }} />
      </div>
      <div className="ab-ad-card__body">
        <div className="ab-ad-card__top">
          <span className="ab-slot-badge" style={{ '--sp': meta.color }}>
            {ad.slot==='banner'?Icon.tv:ad.slot==='tournament'?Icon.trophy:Icon.bolt} {meta.label}
          </span>
          {ad.uid && <code className="ab-uid-tag">{ad.uid}</code>}
          {ad.live && <span className="ab-live-dot"><span />EN VIVO</span>}
          {!ad.active && <span className="ab-hidden-tag">OCULTO</span>}
        </div>
        <h4>{ad.title}</h4>
        {ad.description && <p>{ad.description.slice(0,80)}{ad.description.length>80?'...':''}</p>}
        <div className="ab-ad-card__meta">
          {ad.prize && <span>{Icon.trophy} {ad.prize}</span>}
          {(ad.scheduledDate || ad.meta) && <span>{Icon.clock} {ad.scheduledDate ? fmtDate(ad.scheduledDate) : ad.meta}</span>}
          {ad.btnUrl && <span>{Icon.globe} {ad.btnUrl}</span>}
        </div>
      </div>
      <div className="ab-ad-card__actions">
        <div className="ab-ad-card__order">
          <button className="ab-order-btn" onClick={onMoveUp} disabled={isFirst} title="Subir">↑</button>
          <button className="ab-order-btn" onClick={onMoveDown} disabled={isLast} title="Bajar">↓</button>
        </div>
        <div className="ab-toggle-sm" onClick={onToggle} title={ad.active?'Ocultar':'Mostrar'}>
          <span className={`ab-toggle__knob ${ad.active?'on':''}`} />
        </div>
        <button className="ab-req-act" onClick={onEdit} title="Editar">{Icon.edit}</button>
        {confirmDel
          ? <div className="ab-del-confirm">
              <small>¿Eliminar?</small>
              <button className="ab-req-act ab-req-act--success" onClick={() => { onDelete(); setConfirmDel(false) }}>{Icon.check}</button>
              <button className="ab-req-act" onClick={() => setConfirmDel(false)}>{Icon.x}</button>
            </div>
          : <button className="ab-req-act ab-req-act--danger" onClick={() => setConfirmDel(true)} title="Eliminar">{Icon.trash}</button>
        }
      </div>
    </motion.div>
  )
}

/* ─── RequestDetail ───────────────────────────────────────────── */
function RequestDetail({ req, onClose, onApprove, onReject, onCreateAd }) {
  const [note, setNote] = useState('')
  const typeColor = TYPE_COLORS[req.type] || '#00E676'
  return (
    <motion.div className="ab-detail-overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <motion.div className="ab-detail-panel" initial={{scale:0.92,y:20}} animate={{scale:1,y:0}} exit={{scale:0.92,y:20}}>
        <div className="ab-detail-head">
          <div>
            <span className="ab-detail-type" style={{'--tc':typeColor}}>{Icon.star} {TYPE_LABELS[req.type]||req.type}</span>
            <h3>{req.title}</h3>
            <small>Por <b>{req.userNick}</b> · {new Date(req.submittedAt).toLocaleDateString('es-DO',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</small>
          </div>
          <button className="ab-detail-close" onClick={onClose}>{Icon.x}</button>
        </div>
        {req.images?.length>0 && <div className="ab-detail-imgs">{req.images.map((s,i)=><img key={i} src={s} alt="" />)}</div>}
        {req.description && <p className="ab-detail-desc">{req.description}</p>}
        {req.link && <a href={safeHref(req.link)} className="ab-detail-link" target="_blank" rel="noreferrer">{Icon.globe} {req.link}</a>}
        {req.message && <blockquote className="ab-detail-msg">"{req.message}"</blockquote>}
        {req.status==='pending' && (
          <div className="ab-detail-actions">
            <div className="ab-field" style={{flex:1}}><label>Nota (opcional)</label>
              <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Motivo..." /></div>
            <div className="ab-detail-btns">
              <button className="ab-btn ab-btn--danger" onClick={()=>onReject(req.id,note)}>{Icon.x} Rechazar</button>
              <button className="ab-btn ab-btn--success" onClick={()=>onApprove(req.id,note)}>{Icon.check} Aprobar</button>
            </div>
          </div>
        )}
        {req.status!=='pending' && (
          <div className={`ab-detail-status ab-detail-status--${req.status}`}>
            {req.status==='approved'?Icon.check:Icon.x}
            {req.status==='approved'?'Aprobada':'Rechazada'}
            {req.reviewNote&&<span>· "{req.reviewNote}"</span>}
          </div>
        )}
        <div className="ab-detail-create">
          <button className="ab-save-btn" onClick={() => onCreateAd(req)}>
            {Icon.plus} Crear anuncio desde esta solicitud
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─── PromoEditor ─────────────────────────────────────────────── */
const BLANK_PROMO = {
  id: '', active: true, title: '', subtitle: '', description: '',
  badge: '', cta: 'Ver más', ctaUrl: '',
  bg: 'linear-gradient(135deg, #0d1117 0%, #1a2744 50%, #0d1117 100%)',
}
const BG_PRESETS = [
  { label: 'Azul',     val: 'linear-gradient(135deg, #001a26 0%, #003d5c 50%, #001a26 100%)' },
  { label: 'Rojo',     val: 'linear-gradient(135deg, #1a0001 0%, #4d0003 50%, #1a0001 100%)' },
  { label: 'Verde',    val: 'linear-gradient(135deg, #0a1a0d 0%, #0d3d1a 50%, #0a1a0d 100%)' },
  { label: 'Violeta',  val: 'linear-gradient(135deg, #0d0b1a 0%, #2d2060 50%, #0d0b1a 100%)' },
  { label: 'Borgoña',  val: 'linear-gradient(135deg, #1a0508 0%, #3d0b12 50%, #1a0508 100%)' },
  { label: 'Oscuro',   val: 'linear-gradient(135deg, #0a0a0a 0%, #141414 50%, #0a0a0a 100%)' },
]

function PromoEditor({ promo, saving, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({ ...BLANK_PROMO, ...promo }))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isNew = !promo?._key

  return (
    <motion.div className="ab-editor-overlay" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <motion.div className="ab-editor-modal" initial={{ scale:0.94, y:20 }} animate={{ scale:1, y:0 }} exit={{ scale:0.94, y:20 }}
        transition={{ duration:0.28, ease:[0.22,1,0.36,1] }}>

        <div className="ab-editor-head">
          <div>
            <h3>{isNew ? 'Nuevo anuncio modal' : 'Editar anuncio modal'}</h3>
            <p>Overlay interstitial con cuenta regresiva — aparece en /torneos, /tv y /comunidad</p>
          </div>
          <button className="ab-editor-close" onClick={onCancel}>{Icon.x}</button>
        </div>

        <div className="ab-promo-preview" style={{ background: form.bg }}>
          <span className="ab-live-preview__label">{Icon.eye} PREVIEW · MODAL</span>
          <div className="ab-promo-preview__inner">
            {form.badge && <div className="ab-promo-preview__badge">{form.badge}</div>}
            {form.id && <div className="ab-promo-preview__id">{form.id.toUpperCase()}</div>}
            <b className="ab-promo-preview__title">{form.title || 'Título del anuncio'}</b>
            {form.subtitle && <p className="ab-promo-preview__sub">{form.subtitle}</p>}
            {form.cta && <span className="ab-promo-preview__cta">{form.cta}</span>}
          </div>
        </div>

        <div className="ab-editor-body">
          <div className="ab-ef-section">
            <label className="ab-ef-label">Identificador único (ID de marca)</label>
            <input className="ab-ef-input" value={form.id}
              onChange={e => set('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="fdv-2026, npc-2026" />
            <small style={{ color:'var(--text-dim)', fontSize:11, marginTop:4, display:'block' }}>
              Se muestra como etiqueta de marca en el modal (ej: "LG-2026"). Solo letras y guiones.
            </small>
          </div>

          <div className="ab-ef-section">
            <label className="ab-ef-label">Contenido</label>
            <div className="ab-form-grid">
              <div className="ab-field"><label>Badge / Etiqueta</label>
                <input value={form.badge} onChange={e => set('badge', e.target.value)} placeholder="Oficial VCT 2026" /></div>
              <div className="ab-field"><label>Título *</label>
                <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Nombre del producto o campaña" /></div>
            </div>
            <div className="ab-field" style={{ marginTop:10 }}><label>Subtítulo</label>
              <input value={form.subtitle} onChange={e => set('subtitle', e.target.value)} placeholder="Tagline corto…" /></div>
            <div className="ab-field" style={{ marginTop:10 }}><label>Descripción</label>
              <textarea rows={3} value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Descripción del producto o campaña que verá el usuario…" /></div>
          </div>

          <div className="ab-ef-section">
            <label className="ab-ef-label">Botón de acción (CTA)</label>
            <div className="ab-form-grid">
              <div className="ab-field"><label>Texto del botón</label>
                <input value={form.cta} onChange={e => set('cta', e.target.value)} placeholder="Consíguelo ahora" /></div>
              <div className="ab-field"><label>URL de destino</label>
                <input value={form.ctaUrl} onChange={e => set('ctaUrl', e.target.value)} placeholder="https://… o /torneos" /></div>
            </div>
          </div>

          <div className="ab-ef-section">
            <label className="ab-ef-label">Fondo del modal</label>
            <div className="ab-promo-bg-presets">
              {BG_PRESETS.map(p => (
                <button key={p.val} type="button"
                  className={`ab-bg-preset ${form.bg === p.val ? 'active' : ''}`}
                  style={{ background: p.val }}
                  onClick={() => set('bg', p.val)}>{p.label}</button>
              ))}
            </div>
            <div className="ab-field" style={{ marginTop:10 }}>
              <label>CSS personalizado</label>
              <input value={form.bg} onChange={e => set('bg', e.target.value)}
                placeholder="linear-gradient(135deg, #001a26 0%, #003d5c 100%)" />
            </div>
          </div>

          <div className="ab-ef-opts">
            <label className="ab-toggle">
              <span className={`ab-toggle__knob ${form.active ? 'on' : ''}`} onClick={() => set('active', !form.active)} />
              <span>{form.active ? 'Activo — se mostrará a los usuarios' : 'Oculto — no se mostrará'}</span>
            </label>
          </div>
        </div>

        <div className="ab-editor-foot">
          <button className="ab-btn" onClick={onCancel}>{Icon.x} Cancelar</button>
          <button className="ab-save-btn" disabled={!form.title.trim() || !form.id.trim() || saving} onClick={() => onSave(form)}>
            {Icon.check} {saving ? 'Guardando…' : 'Guardar promo'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─── PromoCard ──────────────────────────────────────────────────── */
function PromoCard({ promo, onEdit, onToggle, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(false)
  return (
    <motion.div className={`ab-ad-card ${promo.active ? '' : 'ab-ad-card--off'}`}
      style={{ '--ac': '#ec4899' }} layout>
      <div className="ab-ad-card__thumb">
        <div className="ab-promo-thumb" style={{ background: promo.bg }}>
          <span>{promo.id?.toUpperCase()}</span>
        </div>
      </div>
      <div className="ab-ad-card__body">
        <div className="ab-ad-card__top">
          <span className="ab-slot-badge" style={{ '--sp': '#ec4899' }}>
            {Icon.star} Modal Promo
          </span>
          {promo.badge && <code className="ab-uid-tag">{promo.badge}</code>}
          {!promo.active && <span className="ab-hidden-tag">OCULTO</span>}
        </div>
        <h4>{promo.title}</h4>
        {promo.subtitle && <p style={{ fontSize:12, color:'var(--text-dim)', margin:'2px 0 4px' }}>{promo.subtitle}</p>}
        {promo.description && <p>{promo.description.slice(0,80)}{promo.description.length>80?'...':''}</p>}
        <div className="ab-ad-card__meta">
          {promo.cta && <span>{Icon.bolt} {promo.cta}</span>}
          {promo.ctaUrl && <span>{Icon.globe} {promo.ctaUrl.slice(0,40)}{promo.ctaUrl.length>40?'…':''}</span>}
        </div>
      </div>
      <div className="ab-ad-card__actions">
        <div className="ab-toggle-sm" onClick={onToggle} title={promo.active?'Ocultar':'Mostrar'}>
          <span className={`ab-toggle__knob ${promo.active?'on':''}`} />
        </div>
        <button className="ab-req-act" onClick={onEdit} title="Editar">{Icon.edit}</button>
        {confirmDel
          ? <div className="ab-del-confirm">
              <small>¿Eliminar?</small>
              <button className="ab-req-act ab-req-act--success" onClick={() => { onDelete(); setConfirmDel(false) }}>{Icon.check}</button>
              <button className="ab-req-act" onClick={() => setConfirmDel(false)}>{Icon.x}</button>
            </div>
          : <button className="ab-req-act ab-req-act--danger" onClick={() => setConfirmDel(true)} title="Eliminar">{Icon.trash}</button>
        }
      </div>
    </motion.div>
  )
}

/* ─── BrandAnalytics ──────────────────────────────────────────── */
function BrandAnalytics({ ads }) {
  const [selId, setSelId] = useState(ads[0]?.id || null)
  const selAd = ads.find(a => a.id === selId) || ads[0]
  const fmtN = n => n >= 1000 ? (n/1000).toFixed(1)+'K' : String(n || 0)
  const ctrOf = ad => ad.impressions ? +((ad.clicks / ad.impressions) * 100).toFixed(1) : 0

  return (
    <div className="ab-analytics">
      {/* Ad selector */}
      <div className="ab-an-selector">
        {ads.map(ad => {
          const meta = SLOT_META[ad.slot] || {}
          return (
            <button key={ad.id} type="button"
              className={`ab-an-adcard ${selId===ad.id?'active':''}`}
              style={{'--ac': ad.color1||meta.color||'var(--accent)'}}
              onClick={() => setSelId(ad.id)}>
              {ad.imageUrl
                ? <img src={ad.imageUrl} alt={ad.title} className="ab-an-adcard__img" />
                : <div className="ab-an-adcard__img ab-an-adcard__img--blank" style={{background:ad.color1}}>{ad.title?.charAt(0)}</div>}
              <div className="ab-an-adcard__info">
                <span className="ab-an-adcard__uid">{ad.uid||ad.id}</span>
                <b>{ad.title}</b>
                <span className="ab-an-adcard__nums">{fmtN(ad.impressions)} vistas · {fmtN(ad.clicks)} clicks</span>
              </div>
            </button>
          )
        })}
      </div>

      {selAd && (
        <div className="ab-an-body">
          {/* Header */}
          <div className="ab-an-head">
            <div className="ab-an-head__left">
              <code className="ab-uid-tag">{selAd.uid||selAd.id}</code>
              <h3>{selAd.title}</h3>
              <span className="ab-slot-badge" style={{'--sp':SLOT_META[selAd.slot]?.color}}>
                {selAd.slot==='banner'?Icon.tv:selAd.slot==='tournament'?Icon.trophy:Icon.bolt} {SLOT_META[selAd.slot]?.label}
              </span>
            </div>
          </div>

          {/* KPIs — contadores reales acumulados (no hay desglose histórico por hora/día todavía) */}
          <div className="ab-an-kpis">
            {[
              {label:'Impresiones totales', val:fmtN(selAd.impressions), icon:Icon.eye, color:'var(--accent)'},
              {label:'Clicks totales',      val:fmtN(selAd.clicks),      icon:Icon.globe,  color:'#3b82f6'},
              {label:'CTR',                 val:`${ctrOf(selAd)}%`,      icon:Icon.chartBar, color:'#f59e0b'},
            ].map(k => (
              <div key={k.label} className="ab-an-kpi" style={{'--kc':k.color}}>
                <span className="ab-an-kpi__icon">{k.icon}</span>
                <b>{k.val}</b>
                <small>{k.label}</small>
              </div>
            ))}
          </div>
          <p className="ab-an-note">Estos números son reales (vienen de la plataforma) y crecen con cada visita real. Todavía no hay desglose histórico por hora/día/mes — solo el total acumulado.</p>
        </div>
      )}
    </div>
  )
}

/* ─── Main ────────────────────────────────────────────────────── */
export default function AdminBanners() {
  const [tab, setTab] = useState('anuncios')
  const [ads, setAds] = useState([])
  const [adsLoading, setAdsLoading] = useState(true)
  const [slotFilter, setSlotFilter] = useState('all')
  const [editingAd, setEditingAd] = useState(null)
  const [savingAd, setSavingAd] = useState(false)
  const [promos, setPromos] = useState([])
  const [editingPromo, setEditingPromo] = useState(null)
  const [savingPromo, setSavingPromo] = useState(false)
  const [requests, setRequests] = useState([])
  const [reqFilter, setReqFilter] = useState('all')
  const [detailReq, setDetailReq] = useState(null)

  const refreshRequests = () => api('/admin/publication-requests')
    .then(res => setRequests(Array.isArray(res.requests) ? res.requests : []))
    .catch(() => toast('No se pudieron cargar las solicitudes', 'error'))
  const { visibility, loaded: visibilityLoaded, refresh: refreshVisibility } = useAdsVisibility()
  const [togglingSlot, setTogglingSlot] = useState(null)

  const refreshAds = () => getSiteAds().then(setAds).catch(() => toast('No se pudieron cargar los anuncios', 'error'))
  const refreshPromos = () => getSitePromos().then(setPromos).catch(() => toast('No se pudieron cargar las promos', 'error'))
  useEffect(() => {
    Promise.all([refreshAds(), refreshPromos()]).finally(() => setAdsLoading(false))
    refreshRequests()
  }, [])

  const handleToggleSectionVisibility = async slot => {
    setTogglingSlot(slot)
    try {
      await setAdSlotVisibility(slot, !visibility[slot])
      refreshVisibility()
      toast(!visibility[slot] ? 'Sección activada' : 'Sección desactivada', 'success')
    } catch {
      toast('No se pudo cambiar el estado de la sección', 'error')
    } finally {
      setTogglingSlot(null)
    }
  }

  const handleSaveAd = async formData => {
    setSavingAd(true)
    try {
      if (formData.id && ads.find(a => a.id === formData.id)) {
        const { id, ...updates } = formData
        await updateSiteAd(id, updates)
      } else {
        await createSiteAd(formData)
      }
      await refreshAds(); setEditingAd(null); toast('Anuncio guardado', 'success')
    } catch {
      toast('No se pudo guardar el anuncio', 'error')
    } finally {
      setSavingAd(false)
    }
  }
  const handleToggle = async id => {
    const ad = ads.find(a=>a.id===id)
    await updateSiteAd(id, { active: !ad.active }).catch(() => toast('No se pudo cambiar el estado', 'error'))
    refreshAds()
  }
  const handleDelete = async id => {
    await deleteSiteAd(id).catch(() => toast('No se pudo eliminar', 'error'))
    refreshAds(); toast('Anuncio eliminado', 'error')
  }
  const handleMove = async (id, dir) => {
    const sorted = [...ads].sort((a,b)=>(a.order??99)-(b.order??99))
    const idx = sorted.findIndex(a=>a.id===id); const ni = idx+dir
    if (ni<0||ni>=sorted.length) return
    const arr=[...sorted];[arr[idx],arr[ni]]=[arr[ni],arr[idx]]
    await reorderSiteAds(arr.map((a,i)=>({id:a.id,order:i}))).catch(() => toast('No se pudo reordenar', 'error'))
    refreshAds()
  }
  const reviewRequest = async (id, status, note) => {
    try {
      const res = await api(`/admin/publication-requests/${id}`, { method: 'PATCH', body: { status, reviewNote: note } })
      setRequests(prev => prev.map(r => r.id === id ? res.request : r))
      setDetailReq(null)
      toast(status === 'approved' ? 'Aprobada' : 'Rechazada', status === 'approved' ? 'success' : 'error')
    } catch (error) {
      toast(error.message || 'No se pudo actualizar la solicitud', 'error')
    }
  }
  const handleApprove = (id, note) => reviewRequest(id, 'approved', note)
  const handleReject  = (id, note) => reviewRequest(id, 'rejected', note)
  const handleCreateAdFromReq = req => {
    setDetailReq(null)
    setTab('anuncios')
    const type = req.type || 'custom'
    setEditingAd({
      ...BLANK_AD,
      type,
      uid: genUid({ type, title: req.title }),
      title: req.title || '',
      description: req.description || '',
      imageUrl: req.images?.[0] || '',
      btnUrl: req.link || '',
      badge: TYPE_LABELS[type] || '',
    })
    toast('Datos de solicitud cargados en editor', 'success')
  }

  const handleSavePromo = async form => {
    setSavingPromo(true)
    try {
      const existing = promos.find(p => p.id === form._key)
      if (existing) {
        const { _key, ...updates } = form
        await updateSitePromo(existing.id, updates)
      } else {
        const { _key, ...rest } = form
        await createSitePromo(rest)
      }
      await refreshPromos(); setEditingPromo(null); toast('Promo guardada', 'success')
    } catch (e) {
      toast(e.message || 'No se pudo guardar la promo', 'error')
    } finally {
      setSavingPromo(false)
    }
  }
  const handleTogglePromo = async id => {
    const p = promos.find(x => x.id === id)
    await updateSitePromo(id, { active: !p.active }).catch(() => toast('No se pudo cambiar el estado', 'error'))
    refreshPromos()
  }
  const handleDeletePromo = async id => {
    await deleteSitePromo(id).catch(() => toast('No se pudo eliminar', 'error'))
    refreshPromos(); toast('Promo eliminada', 'error')
  }

  const pendingCount = requests.filter(r=>r.status==='pending').length
  const slotCounts = { all:ads.length, banner:ads.filter(a=>a.slot==='banner').length, tournament:ads.filter(a=>a.slot==='tournament').length, floating:ads.filter(a=>a.slot==='floating').length, dashboard:ads.filter(a=>a.slot==='dashboard').length, promo:promos.length }
  const filteredAds = (slotFilter==='all'?ads:ads.filter(a=>a.slot===slotFilter)).slice().sort((a,b)=>(a.order??99)-(b.order??99))
  const filteredReqs = reqFilter==='all'?requests:requests.filter(r=>r.status===reqFilter)

  return (
    <div className="ab-page">
      <div className="ab-header">
        <div>
          <h2>{Icon.star} Publicidad &amp; Patrocinios</h2>
          <p>Gestiona todos los anuncios — actívalos, edítalos, asígnalos a cualquier banner</p>
        </div>
        <div className="ab-header-stats">
          <div className="ab-hstat ab-hstat--green"><b>{ads.filter(a=>a.active).length}</b><small>Activos</small></div>
          <div className="ab-hstat ab-hstat--warn"><b>{pendingCount}</b><small>Pendientes</small></div>
          <div className="ab-hstat"><b>{ads.length}</b><small>Anuncios</small></div>
        </div>
      </div>

      <div className="ab-tabs">
        <button className={`ab-tab ${tab==='anuncios'?'active':''}`} onClick={()=>setTab('anuncios')}>{Icon.tv} Anuncios</button>
        <button className={`ab-tab ${tab==='solicitudes'?'active':''}`} onClick={()=>setTab('solicitudes')}>
          {Icon.fileText} Solicitudes {pendingCount>0&&<span className="ab-tab__badge">{pendingCount}</span>}
        </button>
        <button className={`ab-tab ${tab==='metricas'?'active':''}`} onClick={()=>setTab('metricas')}>{Icon.chartBar} Métricas</button>
      </div>

      {tab==='anuncios' && adsLoading && (
        <div className="ab-empty">{Icon.clock}<p>Cargando anuncios…</p></div>
      )}

      {tab==='anuncios' && !adsLoading && (
        <div className="ab-anuncios">
          <div className="ab-ads-bar">
            <div className="ab-slot-filters">
              {SLOTS.map(s=>(
                <button key={s.id} className={`ab-slot-filter-btn ${slotFilter===s.id?'active':''}`}
                  style={{'--sf':s.color}} onClick={()=>setSlotFilter(s.id)}>
                  {s.icon} {s.label} <span className="ab-slot-filter-count">{slotCounts[s.id]}</span>
                </button>
              ))}
            </div>
            <div className="ab-ads-bar-right">
              <button className="ab-new-btn" onClick={()=>setEditingAd({...BLANK_AD,slot:slotFilter==='all'?'banner':slotFilter})}>
                {Icon.plus} Nuevo anuncio
              </button>
            </div>
          </div>

          {slotFilter!=='all' && slotFilter!=='promo' && (
            <div className="ab-slot-info" style={{'--si':SLOT_META[slotFilter]?.color}}>
              <span>{slotFilter==='banner'?Icon.tv:slotFilter==='tournament'?Icon.trophy:Icon.bolt}</span>
              <div><b>{SLOT_META[slotFilter]?.label}</b><small>{SLOT_META[slotFilter]?.desc}</small></div>
              <span className="ab-slot-info-count">
                {ads.filter(a=>a.slot===slotFilter&&a.active).length} activos / {slotCounts[slotFilter]} total
              </span>
              <button
                className={`ab-section-toggle ${visibility[slotFilter] ? 'is-on' : 'is-off'}`}
                disabled={!visibilityLoaded || togglingSlot===slotFilter}
                onClick={()=>handleToggleSectionVisibility(slotFilter)}
                title="Enciende o apaga esta sección en todo el sitio, para todos los visitantes"
              >
                {visibility[slotFilter] ? Icon.check : Icon.x} {visibility[slotFilter] ? 'Sección activada' : 'Sección desactivada'}
              </button>
            </div>
          )}

          {slotFilter === 'promo' ? (
            <>
              <div className="ab-slot-info" style={{ '--si': '#ec4899' }}>
                <span>{Icon.star}</span>
                <div><b>Modal Promo</b><small>Overlay interstitial con countdown de 15s. Se muestra en /torneos, /tv y /comunidad (máx 1 vez cada 15 min)</small></div>
                <span className="ab-slot-info-count">{promos.filter(p=>p.active).length} activos / {promos.length} total</span>
                <button
                  className={`ab-section-toggle ${visibility.promo ? 'is-on' : 'is-off'}`}
                  disabled={!visibilityLoaded || togglingSlot==='promo'}
                  onClick={()=>handleToggleSectionVisibility('promo')}
                  title="Enciende o apaga esta sección en todo el sitio, para todos los visitantes"
                >
                  {visibility.promo ? Icon.check : Icon.x} {visibility.promo ? 'Sección activada' : 'Sección desactivada'}
                </button>
              </div>
              {promos.length === 0
                ? <div className="ab-empty">{Icon.star}<p>No hay promos modales.</p>
                    <button className="ab-new-btn" onClick={() => setEditingPromo({ ...BLANK_PROMO })}>{Icon.plus} Agregar contenido</button>
                  </div>
                : <div className="ab-ad-list">
                    <AnimatePresence>
                      {promos.map(p => (
                        <PromoCard key={p.id} promo={p}
                          onEdit={() => setEditingPromo({ ...p, _key: p.id })}
                          onToggle={() => handleTogglePromo(p.id)}
                          onDelete={() => handleDeletePromo(p.id)} />
                      ))}
                    </AnimatePresence>
                    <button className="ab-new-btn" style={{ marginTop:8 }} onClick={() => setEditingPromo({ ...BLANK_PROMO })}>
                      {Icon.plus} Añadir promo
                    </button>
                  </div>
              }
            </>
          ) : filteredAds.length===0
            ? <div className="ab-empty">{Icon.tv}<p>No hay anuncios en este slot.</p>
                <button className="ab-new-btn" onClick={()=>setEditingAd({...BLANK_AD,slot:slotFilter==='all'?'banner':slotFilter})}>{Icon.plus} Agregar contenido</button>
              </div>
            : <div className="ab-ad-list">
                <AnimatePresence>
                  {filteredAds.map((ad,i)=>(
                    <AdCard key={ad.id} ad={ad} isFirst={i===0} isLast={i===filteredAds.length-1}
                      onEdit={()=>setEditingAd({...ad})} onToggle={()=>handleToggle(ad.id)}
                      onDelete={()=>handleDelete(ad.id)} onMoveUp={()=>handleMove(ad.id,-1)} onMoveDown={()=>handleMove(ad.id,1)} />
                  ))}
                </AnimatePresence>
              </div>
          }
        </div>
      )}

      {tab==='solicitudes' && (
        <div className="ab-solicitudes">
          <div className="ab-req-filters">
            {[['all','Todas'],['pending','Pendientes'],['approved','Aprobadas'],['rejected','Rechazadas']].map(([val,lbl])=>(
              <button key={val} className={`ab-req-filter ${reqFilter===val?'active':''}`} onClick={()=>setReqFilter(val)}>
                {lbl}<span className="ab-req-filter__count">{val==='all'?requests.length:requests.filter(r=>r.status===val).length}</span>
              </button>
            ))}
          </div>
          {filteredReqs.length===0
            ? <div className="ab-empty">{Icon.fileText}<p>Sin solicitudes en esta categoría</p></div>
            : <div className="ab-req-list">
                {filteredReqs.map(req=>(
                  <motion.div key={req.id} className={`ab-req-card ab-req-card--${req.status}`} style={{'--tc':TYPE_COLORS[req.type]||'#00E676'}} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}>
                    {req.images?.[0]&&<div className="ab-req-card__thumb"><img src={req.images[0]} alt="" /></div>}
                    <div className="ab-req-card__body">
                      <div className="ab-req-card__top">
                        <span className="ab-req-type">{TYPE_LABELS[req.type]||req.type}</span>
                        <span className={`ab-req-status ab-req-status--${req.status}`}>{req.status==='pending'?'Pendiente':req.status==='approved'?'✓ Aprobada':'✗ Rechazada'}</span>
                      </div>
                      <h4>{req.title}</h4>
                      {req.description&&<p>{req.description.slice(0,80)}{req.description.length>80?'...':''}</p>}
                      <div className="ab-req-card__meta">
                        <span>{Icon.user} {req.userNick}</span>
                        <span>{Icon.clock} {new Date(req.submittedAt).toLocaleDateString('es-DO',{day:'2-digit',month:'short'})}</span>
                      </div>
                    </div>
                    <div className="ab-req-card__actions">
                      <button className="ab-req-act" onClick={()=>setDetailReq(req)}>{Icon.eye}</button>
                      {req.status==='pending'&&<>
                        <button className="ab-req-act ab-req-act--success" onClick={()=>handleApprove(req.id,'')}>{Icon.check}</button>
                        <button className="ab-req-act ab-req-act--danger" onClick={()=>handleReject(req.id,'')}>{Icon.x}</button>
                      </>}
                    </div>
                  </motion.div>
                ))}
              </div>
          }
        </div>
      )}

      {tab==='metricas' && <BrandAnalytics ads={ads} />}

      <AnimatePresence>
        {editingAd && <AdEditor ad={editingAd} saving={savingAd} onSave={handleSaveAd} onCancel={()=>setEditingAd(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {editingPromo && <PromoEditor promo={editingPromo} saving={savingPromo} onSave={handleSavePromo} onCancel={()=>setEditingPromo(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {detailReq && <RequestDetail req={detailReq} onClose={()=>setDetailReq(null)} onApprove={handleApprove} onReject={handleReject} onCreateAd={handleCreateAdFromReq} />}
      </AnimatePresence>
    </div>
  )
}

