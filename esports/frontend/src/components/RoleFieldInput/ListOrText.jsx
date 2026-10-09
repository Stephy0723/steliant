// Select con la lista del juego (rangos, roles...); si el juego no tiene lista
// conocida cae a texto libre en vez de inventar opciones. Usa las clases
// `role-field` de los paneles.
export default function ListOrText({ label, value, options, onChange, placeholder, optional }) {
  return (
    <label className="role-field">
      <span>{label}{optional ? ' (opcional)' : ''}</span>
      {options.length ? (
        <select value={value} onChange={e => onChange(e.target.value)}>
          <option value="">{optional ? 'Sin indicar' : 'Selecciona…'}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input value={value} maxLength={40} placeholder={placeholder || 'Escríbelo'} onChange={e => onChange(e.target.value)} />
      )}
    </label>
  )
}

