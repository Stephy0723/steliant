import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import RoleApplications from '../../components/RoleApplications/RoleApplications.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import './RoleApply.css'

export default function RoleApply() {
  const navigate = useNavigate()
  return (
    <div className="gg-page gg-roleapply">
      <button className="gg-roleapply__back" onClick={() => navigate(-1)}>
        <span className="gg-roleapply__back-icon">{Icon.chevronRight}</span>
        Volver
      </button>

      <PageHeader
        title="Solicitar un rol"
        sub="Conviértete en Organizador, Creador de contenido, Coach o Caster. Elige el rol y completa el formulario."
      />

      <RoleApplications />
    </div>
  )
}

