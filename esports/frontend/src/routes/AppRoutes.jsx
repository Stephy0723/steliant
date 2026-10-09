import { Navigate, useLocation } from 'react-router-dom'
import Marcas from '../pages/Marcas/Marcas.jsx'
import Universidad from '../pages/Universidad/Universidad.jsx'
import UniversidadPerfil from '../pages/Universidad/UniversidadPerfil.jsx'
import CommunityPage from '../pages/CommunityPage/CommunityPage.jsx'
import Landing from '../pages/Landing/Landing.jsx'
import Login from '../pages/Login/Login.jsx'
import Register from '../pages/Register/Register.jsx'
import VincularWhatsapp from '../pages/VincularWhatsapp/VincularWhatsapp.jsx'
import ForgotPassword from '../pages/ForgotPassword/ForgotPassword.jsx'
import ResetPassword from '../pages/ResetPassword/ResetPassword.jsx'
import VerifyEmail from '../pages/VerifyEmail/VerifyEmail.jsx'
import Terms from '../pages/Legal/Terms.jsx'
import Privacy from '../pages/Legal/Privacy.jsx'
import Payments from '../pages/Legal/Payments.jsx'
import OrganizerTerms from '../pages/Legal/OrganizerTerms.jsx'
import HelpCenter from '../pages/Help/HelpCenter.jsx'
import ChallengerGuide from '../pages/CompetitiveDocs/ChallengerGuide.jsx'
import TicketDetail from '../pages/Help/TicketDetail.jsx'
import PaymentVerify from '../pages/PaymentVerify/PaymentVerify.jsx'
import DashboardLayout from '../layouts/DashboardLayout.jsx'
import AdminLayout from '../layouts/AdminLayout.jsx'
import OrganizerLayout from '../layouts/OrganizerLayout.jsx'
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute.jsx'
import AdminProtectedRoute from '../components/AdminProtectedRoute/AdminProtectedRoute.jsx'
import TeamRoute from '../components/TeamRoute/TeamRoute.jsx'
import Dashboard from '../pages/Dashboard/Dashboard.jsx'
import Games from '../pages/Games/Games.jsx'
import Tournaments from '../pages/Tournaments/Tournaments.jsx'
import Calendar from '../pages/Calendar/Calendar.jsx'
import TournamentCheckout from '../pages/TournamentCheckout/TournamentCheckout.jsx'
import TournamentRegistration from '../pages/TournamentRegistration/TournamentRegistration.jsx'
import TournamentWelcome from '../pages/TournamentWelcome/TournamentWelcome.jsx'
import MyPayments from '../pages/MyPayments/MyPayments.jsx'
import TicketView from '../pages/TicketView/TicketView.jsx'
import OrganizerProfile from '../pages/OrganizerProfile/OrganizerProfile.jsx'
import OrganizersDirectory from '../pages/OrganizersDirectory/OrganizersDirectory.jsx'
import Teams from '../pages/Teams/Teams.jsx'
import JoinTeam from '../pages/Teams/JoinTeam.jsx'
import TeamPage from '../pages/Teams/TeamPage/TeamPage.jsx'
import Community from '../pages/Community/Community.jsx'
import Messages from '../pages/Messages/Messages.jsx'
import News from '../pages/News/News.jsx'
import NewsArticle from '../pages/NewsArticle/NewsArticle.jsx'
import NewsOrganizer from '../pages/NewsOrganizer/NewsOrganizer.jsx'
import Profile from '../pages/Profile/Profile.jsx'
import Notifications from '../pages/Notifications/Notifications.jsx'
import Settings from '../pages/Settings/Settings.jsx'
import ConnectDiscord from '../pages/ConnectDiscord/ConnectDiscord.jsx'
import ConnectWhatsapp from '../pages/ConnectWhatsapp/ConnectWhatsapp.jsx'
import TorneoDetalle from '../pages/TorneoDetalle/TorneoDetalle.jsx'
import MatchStatsReview from '../pages/MatchStatsReview/MatchStatsReview.jsx'
import TorneoCrear from '../pages/TorneoCrear/TorneoCrear.jsx'
import StaffInvitationsPage from '../pages/StaffInvitationsPage/StaffInvitationsPage.jsx'
import Checkout from '../pages/Checkout/Checkout.jsx'
import Raffles from '../pages/Raffles/Raffles.jsx'
import AdminDashboard from '../pages/admin/AdminDashboard/AdminDashboard.jsx'
import AdminOperations from '../pages/admin/AdminOperations/AdminOperations.jsx'
import AdminUsers from '../pages/admin/AdminUsers/AdminUsers.jsx'
import AdminUserExport from '../pages/admin/AdminUserExport/AdminUserExport.jsx'
import AdminExportCenter from '../pages/admin/AdminExportCenter/AdminExportCenter.jsx'
import AdminTournaments from '../pages/admin/AdminTournaments/AdminTournaments.jsx'
import AdminOrganizations from '../pages/admin/AdminOrganizations/AdminOrganizations.jsx'
import AdminTeams from '../pages/admin/AdminTeams/AdminTeams.jsx'
import AdminCommunities from '../pages/admin/AdminCommunities/AdminCommunities.jsx'
import AdminReports from '../pages/admin/AdminReports/AdminReports.jsx'
import AdminTickets from '../pages/admin/AdminTickets/AdminTickets.jsx'
import AdminNews from '../pages/admin/AdminNews/AdminNews.jsx'
import AdminModeration from '../pages/admin/AdminModeration/AdminModeration.jsx'
import AdminPayments from '../pages/admin/AdminPayments/AdminPayments.jsx'
import AdminValidacion from '../pages/admin/AdminValidacion/AdminValidacion.jsx'
import AdminApprovals from '../pages/admin/AdminApprovals/AdminApprovals.jsx'
import AdminBanners from '../pages/admin/AdminBanners/AdminBanners.jsx'
import AdminMarcas from '../pages/admin/AdminMarcas/AdminMarcas.jsx'
import AdminUniversities from '../pages/admin/AdminUniversities/AdminUniversities.jsx'
import AdminRaffles from '../pages/admin/AdminRaffles/AdminRaffles.jsx'
import AdminRoles from '../pages/admin/AdminRoles/AdminRoles.jsx'
import AdminAdmins from '../pages/admin/AdminAdmins/AdminAdmins.jsx'
import AdminLogs from '../pages/admin/AdminLogs/AdminLogs.jsx'
import AdminDiscordSync from '../pages/admin/AdminDiscordSync/AdminDiscordSync.jsx'
import AdminStatsLab from '../pages/admin/AdminStatsLab/AdminStatsLab.jsx' // TEMPORAL
import TournamentOrgRoute from '../components/TournamentOrgRoute/TournamentOrgRoute.jsx'
import TournamentStaffRoute from '../components/TournamentStaffRoute/TournamentStaffRoute.jsx'
import RoleRoute from '../components/RoleRoute/RoleRoute.jsx'
import CoachLayout from '../layouts/CoachLayout.jsx'
import CoachDashboard from '../pages/coach/CoachDashboard/CoachDashboard.jsx'
import CasterLayout from '../layouts/CasterLayout.jsx'
import CasterDashboard from '../pages/caster/CasterDashboard/CasterDashboard.jsx'
import AnalystLayout from '../layouts/AnalystLayout.jsx'
import RoleProfessionalProfile from '../pages/roles/RoleProfessionalProfile/RoleProfessionalProfile.jsx'
import AnalystDashboard from '../pages/analyst/AnalystDashboard/AnalystDashboard.jsx'
import ModeratorLayout from '../layouts/ModeratorLayout.jsx'
import ModeratorDashboard from '../pages/moderator/ModeratorDashboard/ModeratorDashboard.jsx'
import OrganizerDashboard from '../pages/organizer/OrganizerDashboard/OrganizerDashboard.jsx'
import OrganizerResults from '../pages/organizer/OrganizerResults/OrganizerResults.jsx'
import OrganizerTournamentView from '../pages/organizer/OrganizerTournamentView/OrganizerTournamentView.jsx'
import OrganizerTournamentManage from '../pages/organizer/OrganizerTournamentManage/OrganizerTournamentManage.jsx'
import PlayerLayout from '../layouts/PlayerLayout.jsx'
import PlayerDashboard from '../pages/player/PlayerDashboard/PlayerDashboard.jsx'
import PlayerTeams from '../pages/player/PlayerTeams/PlayerTeams.jsx'
import PlayerProfile from '../pages/player/PlayerProfile/PlayerProfile.jsx'
import PlayerFindTeam from '../pages/player/PlayerFindTeam/PlayerFindTeam.jsx'
import PlayerHistory from '../pages/player/PlayerHistory/PlayerHistory.jsx'
import PlayerMatches from '../pages/player/PlayerMatches/PlayerMatches.jsx'
import TeamPanelLayout from '../layouts/TeamPanelLayout.jsx'
import MyTeamPanel from '../pages/team/MyTeamPanel/MyTeamPanel.jsx'
import CreatorLayout from '../layouts/CreatorLayout.jsx'
import BrandLayout from '../layouts/BrandLayout.jsx'
import BrandDashboard from '../pages/brand/BrandDashboard/BrandDashboard.jsx'
import BrandCampaigns from '../pages/brand/BrandCampaigns/BrandCampaigns.jsx'
import BrandContact from '../pages/brand/BrandContact/BrandContact.jsx'
import BrandProfile from '../pages/brand/BrandProfile/BrandProfile.jsx'
import BrandOrganizers from '../pages/brand/BrandOrganizers/BrandOrganizers.jsx'
import CommunityLayout from '../layouts/CommunityLayout.jsx'
import CommunityPanelDashboard from '../pages/Community/CommunityPanelDashboard/CommunityPanelDashboard.jsx'
import CommunityMembers from '../pages/Community/CommunityMembers/CommunityMembers.jsx'
import CommunityPosts from '../pages/Community/CommunityPosts/CommunityPosts.jsx'
import CommunityCreate from '../pages/Community/CommunityCreate/CommunityCreate.jsx'
import Ranking from '../pages/Ranking/Ranking.jsx'
import RoleApply from '../pages/RoleApply/RoleApply.jsx'
import EditProfile from '../pages/EditProfile/EditProfile.jsx'
import NotFound from '../pages/NotFound/NotFound.jsx'
import ComingSoon from '../pages/ComingSoon/ComingSoon.jsx'
import Friends from '../pages/Friends/Friends.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function TestRenderError() {
  throw new Error('Prueba controlada del ErrorBoundary: algo salio mal en esta pagina.')
}

function RedirectDiscordLink() {
  const location = useLocation()
  return <Navigate to={`/conectar-discord${location.search || ''}`} replace />
}

// Con sesión iniciada la Landing no aporta nada: se entra directo al dashboard.
function HomeRoute({ ready }) {
  const { user } = useAuth()
  if (user) return <Navigate to="/dashboard" replace />
  return <Landing started={ready} />
}

// Definición de rutas con react-router-dom v6
export default function AppRoutes({ ready }) {
  return [
    { path: '/', element: <HomeRoute ready={ready} /> },
    { path: '/__test-error', element: <TestRenderError /> },
    { path: '/login', element: <Login /> },
    { path: '/register', element: <Register /> },
    { path: '/vincular-discord', element: <RedirectDiscordLink /> },
    { path: '/vincular-whatsapp', element: <VincularWhatsapp /> },
    { path: '/forgot', element: <ForgotPassword /> },
    { path: '/reset-password', element: <ResetPassword /> },
    { path: '/verify-email', element: <VerifyEmail /> },
    { path: '/terminos', element: <Terms /> },
    { path: '/privacidad', element: <Privacy /> },
    { path: '/politica-pagos', element: <Payments /> },
    { path: '/terminos-organizador', element: <OrganizerTerms /> },
    { path: '/modo-retador', element: <ChallengerGuide /> },
    { path: '/documentos/modo-retador', element: <ChallengerGuide /> },
    { path: '/ayuda', element: <HelpCenter /> },
    { path: '/ayuda/ticket/:code', element: <TicketDetail /> },
    { path: '/verificar', element: <PaymentVerify /> },
    {
      element: <DashboardLayout />,
      children: [
        { path: '/planes', element: <ComingSoon title="Planes y precios" /> },
        { path: '/conectar-discord', element: <ConnectDiscord /> },
      ],
    },
    {
      element: <ProtectedRoute />,
      children: [
        { path: '/mensajes', element: <Messages /> },
        {
          element: <DashboardLayout />,
          children: [
            { path: '/dashboard',        element: <Dashboard /> },
            { path: '/dashhboard',       element: <Navigate to="/dashboard" replace /> },
            { path: '/dashbord',         element: <Navigate to="/dashboard" replace /> },
            { path: '/juegos',           element: <Navigate to="/comunidad" replace /> },
            { path: '/torneos',          element: <Tournaments /> },
            { path: '/calendario',       element: <Calendar /> },
            { path: '/torneos/crear',    element: <TorneoCrear /> },
            { path: '/torneos/invitaciones', element: <StaffInvitationsPage /> },
            { path: '/torneos/:id',      element: <TorneoDetalle /> },
            { path: '/torneos/:id/partidas/:matchId/estadisticas', element: <MatchStatsReview /> },
            { path: '/torneos/:id/inscripcion', element: <TournamentRegistration /> },
            { path: '/torneos/:id/bienvenida',  element: <TournamentWelcome /> },
            { path: '/torneos/:id/pago', element: <TournamentCheckout /> },
            { path: '/mis-pagos',        element: <MyPayments /> },
            { path: '/comprobante/:code', element: <TicketView /> },
            { path: '/organizadores',     element: <OrganizersDirectory /> },
            { path: '/organizadores/:id', element: <OrganizerProfile /> },
            { path: '/creadores',         element: <ComingSoon title="Directorio de creadores" /> },
            { path: '/equipos',           element: <Teams /> },
            { path: '/equipos/unirse/:code', element: <JoinTeam /> },
            { path: '/equipos/:teamId',  element: <TeamPage /> },
            { path: '/tv',               element: <ComingSoon title="GlitchGang TV" /> },
            { path: '/comunidad',        element: <Community /> },
            { path: '/amigos',           element: <Friends /> },
            { path: '/noticias',         element: <News /> },
            { path: '/noticias/:slug',   element: <NewsArticle /> },
            { path: '/noticias/organizador/:slug', element: <NewsOrganizer /> },
            { path: '/perfil',           element: <Profile /> },
            { path: '/notificaciones',   element: <Notifications /> },
            { path: '/ajustes',          element: <Settings /> },
            { path: '/conectar-whatsapp', element: <ConnectWhatsapp /> },
            { path: '/premium',          element: <ComingSoon title="GlitchGang Pro" /> },
            { path: '/premium/checkout', element: <Checkout /> },
            { path: '/redes',            element: <ComingSoon title="Redes sociales" /> },
            { path: '/comunidad/:game',    element: <CommunityPage /> },
            { path: '/marcas',             element: <Marcas /> },
            { path: '/universidad',        element: <Universidad /> },
            // La vinculación universitaria la hace un admin; el viejo formulario redirige.
            { path: '/universidad/registro', element: <Navigate to="/universidad" replace /> },
            { path: '/universidad/:uniId', element: <UniversidadPerfil /> },
            { path: '/ranking',             element: <Ranking /> },
            { path: '/sorteos',             element: <Raffles /> },
            { path: '/solicitar-rol',       element: <RoleApply /> },
            { path: '/editar-perfil',       element: <EditProfile /> },
            { path: '/recompensas',         element: <ComingSoon title="Recompensas" /> },
            { path: '/pro/jugador',          element: <Navigate to="/planes" replace /> },
          ],
        },
        {
          element: <AdminProtectedRoute />,
          children: [
            {
              element: <AdminLayout />,
              children: [
                { path: '/admin',                element: <AdminDashboard /> },
                { path: '/admin/operaciones',    element: <AdminOperations /> },
                { path: '/admin/autorizaciones', element: <AdminApprovals /> },
                { path: '/admin/tickets',        element: <AdminTickets /> },
                { path: '/admin/usuarios',       element: <AdminUsers /> },
                { path: '/admin/usuarios/exportar', element: <AdminUserExport /> },
                { path: '/admin/centro-exportacion', element: <AdminExportCenter /> },
                { path: '/admin/torneos',        element: <AdminTournaments /> },
                { path: '/admin/organizaciones', element: <AdminOrganizations /> },
                { path: '/admin/equipos',        element: <AdminTeams /> },
                { path: '/admin/comunidades',    element: <AdminCommunities /> },
                { path: '/admin/reportes',       element: <AdminReports /> },
                { path: '/admin/noticias',       element: <AdminNews /> },
                { path: '/admin/moderacion',     element: <AdminModeration /> },
                { path: '/admin/pagos',          element: <AdminPayments /> },
                { path: '/admin/validar',        element: <AdminValidacion /> },
                { path: '/admin/banners',        element: <AdminBanners /> },
                { path: '/admin/marcas',         element: <AdminMarcas /> },
                { path: '/admin/universidades',  element: <AdminUniversities /> },
                { path: '/admin/sorteos',        element: <AdminRaffles /> },
                { path: '/admin/roles',          element: <AdminRoles /> },
                { path: '/admin/admins',         element: <AdminAdmins /> },
                { path: '/admin/discord-sync',   element: <AdminDiscordSync /> },
                { path: '/admin/logs',           element: <AdminLogs /> },
                { path: '/admin/laboratorio-estadisticas', element: <AdminStatsLab /> }, // TEMPORAL
              ],
            },
          ],
        },
        {
          element: <TournamentOrgRoute />,
          children: [
            {
              element: <OrganizerLayout />,
              children: [
                { path: '/organizador',            element: <OrganizerDashboard /> },
                { path: '/organizador/resultados', element: <OrganizerResults /> },
                { path: '/organizador/perfil',     element: <RoleProfessionalProfile role="organizer" /> },
                { path: '/organizador/finanzas',   element: <ComingSoon title="Finanzas" homePath="/organizador" /> },
                { path: '/organizador/crm',        element: <ComingSoon title="CRM de organizador" homePath="/organizador" /> },
                { path: '/organizador/integraciones', element: <ComingSoon title="Integraciones" homePath="/organizador" /> },
                { path: '/organizador/configuracion', element: <ComingSoon title="Configuracion" homePath="/organizador" /> },
              ],
            },
          ],
        },
        {
          // A diferencia de arriba, esto tambien deja pasar a staff aceptado
          // de ESE torneo puntual (caster, analista, etc.), no solo a
          // organizador/admin — ver TournamentStaffRoute.
          element: <TournamentStaffRoute />,
          children: [
            {
              element: <OrganizerLayout />,
              children: [
                { path: '/organizador/torneo/:id',           element: <OrganizerTournamentView /> },
                { path: '/organizador/torneo/:id/gestionar', element: <Navigate to="resumen" replace /> },
                { path: '/organizador/torneo/:id/gestionar/:tab', element: <OrganizerTournamentManage /> },
              ],
            },
          ],
        },
        {
          element: <TeamRoute />,
          children: [
            {
              element: <TeamPanelLayout />,
              children: [
                { path: '/mi-equipo',                element: <MyTeamPanel section="resumen" /> },
                { path: '/mi-equipo/roster',          element: <MyTeamPanel section="roster" /> },
                { path: '/mi-equipo/enfrentamiento',  element: <MyTeamPanel section="enfrentamiento" /> },
                { path: '/mi-equipo/planes',          element: <MyTeamPanel section="planes" /> },
                { path: '/mi-equipo/web',             element: <MyTeamPanel section="web" /> },
                { path: '/mi-equipo/patrocinadores',  element: <MyTeamPanel section="patrocinadores" /> },
                { path: '/mi-equipo/reclutar',        element: <MyTeamPanel section="reclutar" /> },
                { path: '/mi-equipo/solicitudes',     element: <MyTeamPanel section="solicitudes" /> },
                // Cronograma solo guardaba en localStorage (no se compartía con el equipo).
                { path: '/mi-equipo/calendario',      element: <ComingSoon title="Cronograma del equipo" homePath="/mi-equipo" /> },
                { path: '/mi-equipo/retador',         element: <MyTeamPanel section="retador" /> },
                { path: '/mi-equipo/privacidad',      element: <MyTeamPanel section="privacidad" /> },
              ],
            },
          ],
        },
        {
          // Todo usuario autenticado es jugador por defecto (role default en
          // el backend es 'player'), asi que este panel NO se gatea por rol:
          // conseguir un rol adicional (brand, organizer, etc.) no debe quitar
          // el acceso a tu propio panel de jugador. Ver AGENTS/BACKEND-PENDIENTE
          // sobre el bug de brands.controller.js que pisa user.role a 'brand'.
          element: <PlayerLayout />,
          children: [
            { path: '/jugador',             element: <PlayerDashboard /> },
            { path: '/jugador/rendimiento', element: <ComingSoon title="Mi rendimiento" homePath="/jugador" /> },
            { path: '/jugador/equipos',     element: <PlayerTeams /> },
            { path: '/jugador/perfil',      element: <PlayerProfile /> },
            { path: '/jugador/buscar-equipo', element: <PlayerFindTeam /> },
            { path: '/jugador/partidas',    element: <PlayerMatches /> },
            { path: '/jugador/historial',   element: <PlayerHistory /> },
          ],
        },
        {
          element: <RoleRoute roles={['creator', 'admin']} />,
          children: [
            {
              element: <CreatorLayout />,
              children: [
                { path: '/creador',              element: <Navigate to="/creador/perfil" replace /> },
                { path: '/creador/contenido',    element: <ComingSoon title="Contenido" homePath="/creador" /> },
                { path: '/creador/analiticas',   element: <ComingSoon title="Analiticas" homePath="/creador" /> },
                { path: '/creador/monetizacion', element: <ComingSoon title="Monetizacion" homePath="/creador" /> },
                { path: '/creador/perfil',       element: <RoleProfessionalProfile role="creator" /> },
              ],
            },
          ],
        },
        {
          element: <RoleRoute roles={['brand', 'admin']} />,
          children: [
            {
              element: <BrandLayout />,
              children: [
                { path: '/marca',               element: <BrandDashboard /> },
                { path: '/marca/mi-marca',      element: <BrandProfile /> },
                { path: '/marca/organizadores', element: <BrandOrganizers /> },
                { path: '/marca/campanas',      element: <BrandCampaigns /> },
                { path: '/marca/inventario',    element: <ComingSoon title="Inventario de marca" homePath="/marca" /> },
                { path: '/marca/naming-rights', element: <ComingSoon title="Naming rights" homePath="/marca" /> },
                { path: '/marca/creatividades', element: <ComingSoon title="Creatividades" homePath="/marca" /> },
                { path: '/marca/reportes',      element: <ComingSoon title="Reportes de marca" homePath="/marca" /> },
                { path: '/marca/contacto',      element: <BrandContact /> },
              ],
            },
          ],
        },
        {
          element: <RoleRoute roles={['organizer', 'admin']} />,
          children: [
            {
              element: <CommunityLayout />,
              children: [
                { path: '/mi-comunidad',               element: <CommunityPanelDashboard /> },
                { path: '/mi-comunidad/operaciones',   element: <ComingSoon title="Operaciones" homePath="/mi-comunidad" /> },
                { path: '/mi-comunidad/crear',         element: <CommunityCreate /> },
                { path: '/mi-comunidad/editar/:id',    element: <CommunityCreate /> },
                { path: '/mi-comunidad/miembros',      element: <CommunityMembers /> },
                { path: '/mi-comunidad/publicaciones', element: <CommunityPosts /> },
                { path: '/mi-comunidad/web',           element: <ComingSoon title="Sitio web de comunidad" homePath="/mi-comunidad" /> },
              ],
            },
          ],
        },
        {
          element: <RoleRoute roles={['coach', 'admin']} />,
          children: [
            {
              element: <CoachLayout />,
              children: [
                { path: '/coach',           element: <CoachDashboard /> },
                { path: '/coach/jugadores', element: <CoachDashboard /> },
                { path: '/coach/sesiones',  element: <CoachDashboard /> },
                { path: '/coach/analisis',  element: <CoachDashboard /> },
              ],
            },
          ],
        },
        {
          element: <RoleRoute roles={['caster', 'admin']} />,
          children: [
            {
              element: <CasterLayout />,
              children: [
                { path: '/caster',           element: <CasterDashboard /> },
                { path: '/caster/eventos',   element: <CasterDashboard /> },
                { path: '/caster/emisiones', element: <CasterDashboard /> },
                { path: '/caster/stats',     element: <CasterDashboard /> },
                { path: '/caster/perfil',    element: <RoleProfessionalProfile role="caster" /> },
              ],
            },
          ],
        },
        {
          element: <RoleRoute roles={['analyst', 'admin']} />,
          children: [
            {
              element: <AnalystLayout />,
              children: [
                { path: '/analista',          element: <AnalystDashboard /> },
                { path: '/analista/reportes', element: <AnalystDashboard /> },
                { path: '/analista/equipos',  element: <AnalystDashboard /> },
                { path: '/analista/torneos',  element: <AnalystDashboard /> },
                { path: '/analista/perfil',   element: <RoleProfessionalProfile role="analyst" /> },
              ],
            },
          ],
        },
        {
          element: <RoleRoute roles={['moderator', 'admin']} />,
          children: [
            {
              element: <ModeratorLayout />,
              children: [
                { path: '/moderador',            element: <ModeratorDashboard /> },
                { path: '/moderador/eventos',    element: <ModeratorDashboard /> },
                { path: '/moderador/arbitraje',  element: <ModeratorDashboard /> },
                { path: '/moderador/produccion', element: <ModeratorDashboard /> },
              ],
            },
          ],
        },
      ],
    },
    { path: '*', element: <NotFound /> },
  ]
}

