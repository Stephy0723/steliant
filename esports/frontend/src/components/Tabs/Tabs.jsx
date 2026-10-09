import './Tabs.css'

// Tabs reutilizables: array de { id, label } y valor/setter externos.
export default function Tabs({ tabs, value, onChange }) {
  return (
    <div className="gg-tabs-wrap" data-scroll-hint="true">
      <div className="gg-tabs" role="tablist">
        {tabs.map((tab) => (
          <button key={tab.id} role="tab" aria-selected={value === tab.id}
            className={`gg-tab ${value === tab.id ? 'gg-tab--active' : ''}`}
            onClick={() => onChange(tab.id)}>
            {tab.label}
            {tab.badge != null && <span className="gg-tab__badge">{tab.badge}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

