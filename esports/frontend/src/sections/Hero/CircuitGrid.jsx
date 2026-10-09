import { motion } from 'framer-motion'

const NODES = [
  { cls: 'tl', path: 'M13 2 3 14h7l-1 8 10-12h-7z' },
  { cls: 'tr', path: 'M12 2 2 7l10 5 10-5z M2 17l10 5 10-5 M2 12l10 5 10-5' },
  { cls: 'bl', path: 'M12 8 a4 4 0 1 0 0-8 a4 4 0 0 0 0 8 M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1' },
  { cls: 'br', path: 'M3 3h18v18H3z M9 9h6v6H9z' },
]
const WIRES = [
  'M50,40 H360 Q400,40 400,90 V150',
  'M910,40 H600 Q560,40 560,90 V150',
  'M150,300 H380 Q420,300 420,250 V200',
  'M810,300 H580 Q540,300 540,250 V200',
]

export default function CircuitGrid() {
  return (
    <div className="gg-circuit">
      <svg viewBox="0 0 960 340" preserveAspectRatio="none">
        {WIRES.map((d, i) => <path key={'w' + i} className="wire" d={d} />)}
        {WIRES.map((d, i) => (
          <path key={'l' + i} className="wire-lit" d={d} style={{ animationDelay: `${-i * 0.7}s` }} />
        ))}
      </svg>

      <motion.div className="gg-core"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 160, damping: 14 }}>
        GG
      </motion.div>

      {NODES.map((n, i) => (
        <motion.div key={n.cls} className={`gg-node ${n.cls}`}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 + i * 0.12, type: 'spring', stiffness: 200, damping: 16 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={n.path} /></svg>
        </motion.div>
      ))}
    </div>
  )
}

