import './FilterTag.css'

export default function FilterTag({ label, active, onClick, dark = false }) {
  return (
    <button
      className={`gg-filter-tag ${active ? 'active' : ''} ${dark ? 'dark' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

