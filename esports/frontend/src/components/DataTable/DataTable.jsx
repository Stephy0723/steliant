import './DataTable.css'

/**
 * Generic data table.
 * columns: [{ key, label, render? }]
 * rows: array of row objects
 * actions?: (row) => ReactNode
 */
export default function DataTable({ columns, rows, actions }) {
  return (
    <div className="gg-datatable-wrap">
      <table className="gg-datatable">
        <thead>
          <tr>
            {columns.map(c => <th key={c.key}>{c.label}</th>)}
            {actions && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.id ?? ri}>
              {columns.map(c => (
                <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
              ))}
              {actions && <td className="gg-datatable__actions">{actions(row)}</td>}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={columns.length + (actions ? 1 : 0)} className="gg-datatable__empty">Sin registros.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

