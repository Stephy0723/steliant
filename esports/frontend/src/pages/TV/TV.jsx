import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import SponsorBanner from '../../components/SponsorBanner/SponsorBanner.jsx'
import PromoModal from '../../components/PromoModal/PromoModal.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { PLATINUM_SPONSORS } from '../../data/sponsors.js'
import './TV.css'

export default function TV() {
  const { t } = useLang()

  return (
    <div className="gg-page">
      <PromoModal />
      <PageHeader title={t.side.tv} sub="Transmisiones en directo de torneos." />
      <SponsorBanner sponsor={PLATINUM_SPONSORS[1]} />

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '80px 20px', gap: '16px',
        color: 'var(--text-dim)', textAlign: 'center',
      }}>
        <span style={{ fontSize: '2.5rem', opacity: 0.4 }}>{Icon.play}</span>
        <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>No hay transmisiones activas</p>
        <small style={{ maxWidth: 340, lineHeight: 1.5 }}>
          Las transmisiones en vivo de torneos aparecerán aquí cuando estén disponibles.
        </small>
      </div>
    </div>
  )
}

