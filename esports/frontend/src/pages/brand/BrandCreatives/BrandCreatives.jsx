import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import GGLoader from '../../../components/GGLoader/GGLoader.jsx'
import {
  getMyBrand, uploadCreative, deleteCreative, updateCreative,
  getCreativeFile, fileToBase64, guessFormat, fmtBytes,
} from '../../../lib/brandApi.js'
import '../BrandCampaigns/BrandCampaigns.css'
import './BrandCreatives.css'

const STATUS_LABEL = { approved: 'Aprobada', review: 'En revisión', rejected: 'Rechazada' }
const STATUS_TAG   = { approved: 'pnl-tag--ok', review: 'pnl-tag--warn', rejected: 'pnl-tag--live' }

const MAX_SIZE = 7 * 1024 * 1024  // 7 MB client-side guard

function PreviewModal({ creative, brandId, onClose }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    let alive = true
    getCreativeFile(brandId, creative._id)
      .then(d => { if (alive && d.fileData) setSrc(d.fileData) })
      .catch(() => {})
    return () => { alive = false }
  }, [brandId, creative._id])

  return (
    <motion.div className="bcr-preview-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <motion.div className="bcr-preview-box" initial={{ scale: .9 }} animate={{ scale: 1 }} exit={{ scale: .9 }}
        onClick={e => e.stopPropagation()}>
        <div className="bcr-preview-head">
          <span>{creative.name}</span>
          <button onClick={onClose}>{Icon.x}</button>
        </div>
        {src ? (
          src.startsWith('data:video') ? (
            <video src={src} controls className="bcr-preview-media" />
          ) : (
            <img src={src} alt={creative.name} className="bcr-preview-media" />
          )
        ) : (
          <div className="bcr-preview-load"><GGLoader label="Renderizando preview" size="sm" /></div>
        )}
      </motion.div>
    </motion.div>
  )
}

function LinkCampaignModal({ creative, campaigns, brandId, onClose, onUpdated }) {
  const [campaignId, setCampaignId] = useState(creative.campaignId?._id || creative.campaignId || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const updated = await updateCreative(brandId, creative._id, { campaignId: campaignId || null })
      onUpdated(updated)
      onClose()
    } catch { setSaving(false) }
  }

  return (
    <motion.div className="bc-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div className="bcr-link-modal" initial={{ scale: .95 }} animate={{ scale: 1 }} exit={{ scale: .95 }}>
        <div className="bc-modal__head">
          <div><h3>Vincular a campaña</h3><p>{creative.name}</p></div>
          <button onClick={onClose}>{Icon.x}</button>
        </div>
        <select value={campaignId} onChange={e => setCampaignId(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg-card)', color: 'var(--text)', font: 'inherit', fontSize: 14 }}>
          <option value="">— Sin campaña —</option>
          {campaigns.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <div className="bc-modal__foot" style={{ marginTop: 8 }}>
          <button className="pnl-btn" onClick={onClose}>Cancelar</button>
          <button className="pnl-btn pnl-btn--primary" onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Vincular'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function BrandCreatives() {
  const inputRef    = useRef(null)
  const [items,     setItems]     = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [brandId,   setBrandId]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [toast,     setToast]     = useState({ msg: '', type: '' })
  const [preview,   setPreview]   = useState(null)
  const [linking,   setLinking]   = useState(null)
  const [noBrand,   setNoBrand]   = useState(false)

  const showToast = (msg, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), 4000) }

  useEffect(() => {
    let alive = true
    getMyBrand()
      .then(d => {
        if (!alive) return
        setBrandId(d.brand._id)
        setItems(d.creatives || [])
        setCampaigns((d.campaigns || []).filter(c => ['draft', 'rejected'].includes(c.status)))
      })
      .catch(() => { if (alive) setNoBrand(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const onFiles = async (fileList) => {
    if (!brandId || uploading) return
    const files = Array.from(fileList)

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        showToast(`"${file.name}" supera el límite de 7 MB. Usa una versión comprimida.`, 'err')
        continue
      }

      setUploading(true)
      try {
        const fileData = await fileToBase64(file)
        const format   = guessFormat(file)
        const uploaded = await uploadCreative(brandId, {
          name:      file.name,
          format,
          sizeBytes: file.size,
          mimeType:  file.type,
          fileData,
        })
        setItems(prev => [{ ...uploaded, _localPreview: fileData }, ...prev])
        showToast(`"${file.name}" subida. Pendiente de revisión.`)
      } catch (err) {
        showToast(`Error subiendo "${file.name}": ${err.message}`, 'err')
      } finally {
        setUploading(false)
      }
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDelete = async (id) => {
    try {
      await deleteCreative(brandId, id)
      setItems(prev => prev.filter(i => i._id !== id))
      showToast('Creatividad eliminada.')
    } catch (err) {
      showToast(`Error: ${err.message}`, 'err')
    }
  }

  const handleUpdated = (updated) => {
    setItems(prev => prev.map(i => i._id === updated._id ? { ...i, ...updated } : i))
  }

  if (loading) return <div className="pnl-empty"><GGLoader label="Sincronizando creatividades" size="sm" /></div>
  if (noBrand) return <div className="pnl-empty"><div className="pnl-empty__icon">{Icon.palette}</div><h3>Sin marca asignada</h3></div>

  return (
    <div>
      <div className="pnl-head">
        <div>
          <h1>Creatividades</h1>
          <p>Sube banners, overlays y piezas. Cada archivo pasa por revisión antes de publicarse.</p>
        </div>
        <button className="pnl-btn pnl-btn--primary" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? Icon.clock : Icon.upload} {uploading ? 'Subiendo…' : 'Subir creatividad'}
        </button>
      </div>

      <AnimatePresence>
        {toast.msg && (
          <motion.div className={`bc-sent ${toast.type === 'err' ? 'bc-sent--err' : ''}`}
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {toast.type === 'err' ? Icon.x : Icon.check} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dropzone */}
      <div
        className={`bcr-dropzone ${uploading ? 'uploading' : ''}`}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); onFiles(e.dataTransfer.files) }}
      >
        {uploading ? Icon.clock : Icon.upload}
        <span>{uploading ? 'Subiendo archivo…' : 'Arrastra archivos aquí o haz clic para subir'}</span>
        <small>PNG, JPG, GIF o MP4 · máx. 7 MB por archivo · respeta las medidas del inventario</small>
        <input ref={inputRef} type="file" multiple accept="image/*,video/mp4" style={{ display: 'none' }}
          onChange={e => onFiles(e.target.files)} />
      </div>

      {/* Especificaciones */}
      <div className="bcr-specs">
        {[
          { name: 'Banner home',         dims: '1920×320 px', ext: 'JPG/PNG' },
          { name: 'Overlay stream',      dims: '512×512 px',  ext: 'PNG' },
          { name: 'Bracket (torneo)',    dims: '300×100 px',  ext: 'PNG' },
          { name: 'Newsletter',          dims: '600×200 px',  ext: 'JPG/PNG' },
          { name: 'Interstitial in-app', dims: '1080×1920',   ext: 'JPG/MP4' },
        ].map(s => (
          <div key={s.name} className="bcr-spec">
            <b>{s.name}</b>
            <span>{s.dims} · {s.ext}</span>
          </div>
        ))}
      </div>

      {/* Lista */}
      <motion.div className="pnl-card pnl-section-gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="pnl-card__title">
          {Icon.palette} Mis creatividades
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-dim)' }}>{items.length} archivo{items.length !== 1 ? 's' : ''}</span>
        </div>

        {items.length === 0 ? (
          <div className="pnl-empty" style={{ padding: '2rem 0' }}>
            <div className="pnl-empty__icon">{Icon.palette}</div>
            <h3>Aún no has subido creatividades</h3>
            <p>Sube tu primera pieza para vincularla a una campaña.</p>
          </div>
        ) : (
          <div className="bcr-grid">
            {items.map((c, i) => {
              const thumb = c._localPreview || null
              const isImg = c.mimeType?.startsWith('image/') || (!c.mimeType && !c.name?.endsWith('.mp4'))
              const campaignName = c.campaignId?.name || null

              return (
                <motion.div key={c._id} className="bcr-item"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <div className="bcr-item__thumb" onClick={() => setPreview(c)}>
                    {thumb && isImg ? (
                      <img src={thumb} alt={c.name} className="bcr-item__img" />
                    ) : (
                      <span className="bcr-item__icon">{isImg ? Icon.palette : Icon.tv}</span>
                    )}
                    <span className="bcr-item__eye">{Icon.eye}</span>
                  </div>

                  <div className="bcr-item__info">
                    <span className="bcr-item__name" title={c.name}>{c.name}</span>
                    <span className="bcr-item__meta">{c.format || '—'} · {c.sizeBytes ? fmtBytes(c.sizeBytes) : '—'}</span>

                    <div className="bcr-item__campaign" onClick={() => setLinking(c)}>
                      {campaignName ? (
                        <><span className="pnl-tag pnl-tag--accent" style={{ fontSize: 10 }}>{campaignName}</span></>
                      ) : (
                        <button className="pnl-link" style={{ fontSize: 11 }}>{Icon.plus} Vincular campaña</button>
                      )}
                    </div>

                    <div className="bcr-item__foot">
                      <span className={`pnl-tag ${STATUS_TAG[c.status] || ''}`}>{STATUS_LABEL[c.status]}</span>
                      {c.status === 'rejected' && c.rejectionReason && (
                        <span className="bcr-item__reject" title={c.rejectionReason}>{Icon.x} Ver motivo</span>
                      )}
                      <button className="bcr-del" onClick={() => handleDelete(c._id)} title="Eliminar">{Icon.trash}</button>
                    </div>

                    {c.status === 'rejected' && c.rejectionReason && (
                      <p className="bcr-item__reject-msg">{c.rejectionReason}</p>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* Preview modal */}
      <AnimatePresence>
        {preview && brandId && (
          <PreviewModal creative={preview} brandId={brandId} onClose={() => setPreview(null)} />
        )}
      </AnimatePresence>

      {/* Link campaign modal */}
      <AnimatePresence>
        {linking && brandId && (
          <LinkCampaignModal
            creative={linking}
            campaigns={campaigns}
            brandId={brandId}
            onClose={() => setLinking(null)}
            onUpdated={handleUpdated}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

