import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Building2,
  Download,
  FileSpreadsheet,
  IdCard,
  Rocket,
  ShieldCheck,
  Swords,
  UserPlus,
} from 'lucide-react';
import styles from './ControlPanel.module.css';

function getInitialTournamentId(tournaments, activeTournament) {
  return String(activeTournament?.id || tournaments[0]?.id || '');
}

function getDefaultTournamentForm() {
  return {
    name: '',
    organizerType: 'glitchgang',
    organizerName: 'GlitchGang',
    contactEmail: '',
    botEnabled: true,
    accessModel: 'free',
    commissionRate: 0,
    perTournamentFee: 0,
  };
}

function getDefaultPlayerForm() {
  return {
    name: '',
    discordId: '',
    discordUsername: '',
    isLeader: false,
  };
}

function sanitizeDiscordUsername(value) {
  return String(value || '').trim().replace(/^@+/, '');
}

function isValidDiscordId(value) {
  return /^\d{17,20}$/.test(String(value || '').trim());
}

function isValidDiscordUsername(value) {
  const username = sanitizeDiscordUsername(value);
  if (!username) return false;

  const legacyTag = /^.{2,32}#[0-9]{4}$/;
  const modernUsername = /^(?=.{2,32}$)(?!.*\.\.)(?![_.])(?!.*[_.]$)[a-z0-9._]+$/;

  return legacyTag.test(username) || modernUsername.test(username.toLowerCase());
}

function getIdentityFeedback(playerForm) {
  const discordId = String(playerForm.discordId || '').trim();
  const discordUsername = sanitizeDiscordUsername(playerForm.discordUsername);

  if (!discordId && !discordUsername) {
    return {
      tone: 'warning',
      message: 'Registra un Discord ID o un nombre de Discord exacto para poder vincular al jugador.',
      canSubmit: false,
    };
  }

  if (discordId && !isValidDiscordId(discordId)) {
    return {
      tone: 'error',
      message: 'El Discord ID debe ser un numero real de 17 a 20 digitos.',
      canSubmit: false,
    };
  }

  if (discordUsername && !isValidDiscordUsername(discordUsername)) {
    return {
      tone: 'error',
      message: 'El nombre de Discord no tiene un formato valido. Usa el username exacto o usuario#1234.',
      canSubmit: false,
    };
  }

  if (playerForm.isLeader && !discordId) {
    return {
      tone: 'error',
      message: 'El lider debe quedar enlazado con un Discord ID valido para bloquear suplantaciones y reportes falsos.',
      canSubmit: false,
    };
  }

  if (discordId) {
    return {
      tone: 'success',
      message: 'Identidad fuerte lista. Ese jugador quedara vinculado por Discord ID.',
      canSubmit: true,
    };
  }

  return {
    tone: 'warning',
    message: 'Solo hay username. El jugador se registrara como identidad provisional; para bloquear suplantaciones usa Discord ID.',
    canSubmit: true,
  };
}

function StatChip({ label, value, tone = 'neutral' }) {
  return (
    <div className={`${styles.statChip} ${styles[`chip_${tone}`] || ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function ControlPanel({ tournaments, activeTournament, busyAction, handlers, auth }) {
  const [tournamentForm, setTournamentForm] = useState(getDefaultTournamentForm);
  const [teamTournamentId, setTeamTournamentId] = useState(getInitialTournamentId(tournaments, activeTournament));
  const [teamName, setTeamName] = useState('');
  const [playerTournamentId, setPlayerTournamentId] = useState(getInitialTournamentId(tournaments, activeTournament));
  const [playerTeamName, setPlayerTeamName] = useState('');
  const [playerForm, setPlayerForm] = useState(getDefaultPlayerForm);
  const [playerFormError, setPlayerFormError] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importActive, setImportActive] = useState(true);

  const teamTournament = useMemo(
    () => tournaments.find((tournament) => String(tournament.id) === String(teamTournamentId)),
    [teamTournamentId, tournaments]
  );

  const playerTournament = useMemo(
    () => tournaments.find((tournament) => String(tournament.id) === String(playerTournamentId)),
    [playerTournamentId, tournaments]
  );

  const playerTeams = playerTournament?.teams || [];
  const identityFeedback = useMemo(() => getIdentityFeedback(playerForm), [playerForm]);
  const isReadonly = !auth?.isAuthorized;
  const accessMessage = !auth?.configured
    ? 'Configura el login con Discord para habilitar cambios protegidos dentro del CRM.'
    : !auth?.user
      ? 'Inicia sesion con Discord para crear torneos, editar equipos y operar el CRM.'
      : 'Tu cuenta esta en solo lectura. Si debes operar el CRM, agrega tu Discord ID a CRM_ADMIN_DISCORD_IDS.';

  useEffect(() => {
    const fallbackId = getInitialTournamentId(tournaments, activeTournament);

    if (!teamTournamentId && fallbackId) {
      setTeamTournamentId(fallbackId);
    }

    if (!playerTournamentId && fallbackId) {
      setPlayerTournamentId(fallbackId);
    }
  }, [activeTournament, playerTournamentId, teamTournamentId, tournaments]);

  useEffect(() => {
    if (!playerTeams.some((team) => team.name === playerTeamName)) {
      setPlayerTeamName(playerTeams[0]?.name || '');
    }
  }, [playerTeamName, playerTeams]);

  useEffect(() => {
    setTournamentForm((current) => {
      if (current.organizerType === 'glitchgang') {
        return {
          ...current,
          organizerName: 'GlitchGang',
          accessModel: 'free',
          commissionRate: 0,
          perTournamentFee: 0,
        };
      }

      if (current.accessModel === 'free') {
        return {
          ...current,
          accessModel: current.botEnabled ? 'commission' : 'platform-only',
          organizerName: current.organizerName === 'GlitchGang' ? '' : current.organizerName,
        };
      }

      if (!current.botEnabled && current.accessModel !== 'platform-only') {
        return {
          ...current,
          accessModel: 'platform-only',
          commissionRate: 0,
          perTournamentFee: 0,
        };
      }

      if (current.botEnabled && current.accessModel === 'platform-only') {
        return {
          ...current,
          accessModel: 'commission',
        };
      }

      return current;
    });
  }, [tournamentForm.organizerType, tournamentForm.botEnabled, tournamentForm.accessModel]);

  function updateTournamentField(field, value) {
    setTournamentForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updatePlayerField(field, value) {
    setPlayerForm((current) => ({
      ...current,
      [field]: value,
    }));
    setPlayerFormError('');
  }

  async function handleCreateTournament(event) {
    event.preventDefault();
    if (isReadonly) return;
    await handlers.createTournament({
      name: tournamentForm.name,
      makeActive: true,
      organizerType: tournamentForm.organizerType,
      organizerName: tournamentForm.organizerName,
      contactEmail: tournamentForm.contactEmail,
      botEnabled: tournamentForm.botEnabled,
      accessModel: tournamentForm.accessModel,
      commissionRate: tournamentForm.botEnabled ? tournamentForm.commissionRate : 0,
      perTournamentFee: tournamentForm.botEnabled ? tournamentForm.perTournamentFee : 0,
      sourceType: 'crm',
    });
    setTournamentForm(getDefaultTournamentForm());
  }

  async function handleAddTeam(event) {
    event.preventDefault();
    if (isReadonly) return;
    await handlers.addTeam({ tournamentId: teamTournamentId, teamName });
    setTeamName('');
  }

  async function handleAddPlayer(event) {
    event.preventDefault();
    if (isReadonly) return;

    if (!identityFeedback.canSubmit) {
      setPlayerFormError(identityFeedback.message);
      return;
    }

    await handlers.addPlayer({
      tournamentId: playerTournamentId,
      teamName: playerTeamName,
      player: {
        name: playerForm.name,
        discordId: playerForm.discordId.trim(),
        discordUsername: sanitizeDiscordUsername(playerForm.discordUsername),
        isLeader: playerForm.isLeader,
      },
    });

    setPlayerForm(getDefaultPlayerForm());
    setPlayerFormError('');
  }

  async function handleImport(event) {
    event.preventDefault();
    if (isReadonly) return;
    if (!importFile) return;

    const form = event.currentTarget;
    await handlers.importFile({ file: importFile, makeActive: importActive });
    setImportFile(null);
    form.reset();
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.head}>
        <div>
          <span className={styles.sectionLabel}>Tournament Ops</span>
          <h3>Centro de control de torneos</h3>
        </div>
        <p>
          Aqui organizas el torneo con una estructura mas limpia: propiedad del evento, acceso al
          bot, equipos y una identidad Discord mas segura para cada jugador.
        </p>

        <div className={styles.statsRow}>
          <StatChip label="Torneos cargados" value={tournaments.length} />
          <StatChip label="Bot en evento activo" value={activeTournament?.bot?.enabled ? 'Si' : 'No'} tone={activeTournament?.bot?.enabled ? 'success' : 'warning'} />
          <StatChip label="Origen del activo" value={activeTournament?.source?.type || 'crm'} />
        </div>
      </div>

      {isReadonly ? (
        <div className={styles.noticeBox}>
          <ShieldCheck size={16} />
          <span>{accessMessage}</span>
        </div>
      ) : null}

      <div className={styles.stack}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <Swords size={18} />
            <div>
              <h4>Crear torneo</h4>
              <p>
                Define primero el dueño del evento y la politica comercial. Asi el CRM sabe si el
                bot entra gratis o bajo fee/comision.
              </p>
            </div>
          </div>

          <div className={styles.noticeBox}>
            <Bot size={16} />
            <span>
              Todo lo que registres aqui debe coincidir con la web o con la API para que el bot
              lea el torneo correcto sin depender de datos sueltos.
            </span>
          </div>

          <form className={styles.form} onSubmit={handleCreateTournament}>
            <div className={styles.formSection}>
              <div className={styles.formSectionHead}>
                <Building2 size={16} />
                <div>
                  <strong>Datos base del evento</strong>
                  <span>Identifica el torneo y quien lo opera.</span>
                </div>
              </div>

              <div className={styles.inputGrid}>
                <label className={styles.fieldWide}>
                  Nombre del torneo
                  <input
                    value={tournamentForm.name}
                    onChange={(event) => updateTournamentField('name', event.target.value)}
                    placeholder="GlitchGang Spring Cup"
                    required
                  />
                </label>

                <label>
                  Organizador
                  <select
                    value={tournamentForm.organizerType}
                    onChange={(event) => updateTournamentField('organizerType', event.target.value)}
                  >
                    <option value="glitchgang">GlitchGang</option>
                    <option value="partner">Empresa / Organizador externo</option>
                  </select>
                </label>

                <label>
                  Nombre comercial
                  <input
                    value={tournamentForm.organizerName}
                    onChange={(event) => updateTournamentField('organizerName', event.target.value)}
                    placeholder="GlitchGang"
                    required
                  />
                </label>

                <label className={styles.fieldWide}>
                  Email de contacto
                  <input
                    type="email"
                    value={tournamentForm.contactEmail}
                    onChange={(event) => updateTournamentField('contactEmail', event.target.value)}
                    placeholder="ops@glitchgang.gg"
                  />
                </label>
              </div>
            </div>

            <div className={styles.formSection}>
              <div className={styles.formSectionHead}>
                <Bot size={16} />
                <div>
                  <strong>Acceso al bot</strong>
                  <span>Controla si el bot queda incluido, cobrado por fee o por comision.</span>
                </div>
              </div>

              <div className={styles.inputGrid}>
                <label className={styles.fieldWide}>
                  Uso comercial del bot
                  <select
                    value={tournamentForm.accessModel}
                    onChange={(event) => updateTournamentField('accessModel', event.target.value)}
                    disabled={tournamentForm.organizerType === 'glitchgang'}
                  >
                    <option value="free">Gratis</option>
                    <option value="commission">Comision por torneo</option>
                    <option value="per_tournament">Fee por torneo</option>
                    <option value="platform-only">Solo CRM/API sin bot</option>
                  </select>
                </label>

                <label className={styles.checkboxCard}>
                  <input
                    type="checkbox"
                    checked={tournamentForm.botEnabled}
                    onChange={(event) => updateTournamentField('botEnabled', event.target.checked)}
                  />
                  <div>
                    <strong>Habilitar bot para este torneo</strong>
                    <span>Si se desactiva, el CRM sigue operativo pero el bot no tomara este evento.</span>
                  </div>
                </label>

                {tournamentForm.organizerType === 'partner' && tournamentForm.botEnabled ? (
                  <>
                    <label>
                      Fee por torneo
                      <input
                        type="number"
                        min="0"
                        value={tournamentForm.perTournamentFee}
                        onChange={(event) => updateTournamentField('perTournamentFee', event.target.value)}
                        disabled={tournamentForm.accessModel !== 'per_tournament'}
                      />
                    </label>

                    <label>
                      Comision %
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={tournamentForm.commissionRate}
                        onChange={(event) => updateTournamentField('commissionRate', event.target.value)}
                        disabled={tournamentForm.accessModel !== 'commission'}
                      />
                    </label>
                  </>
                ) : null}
              </div>
            </div>

            <div className={styles.footerHint}>
              <span>Web interna: <code>/portal/tournaments/sync</code></span>
              <span>Terceros: <code>/api/v1/tournaments/sync</code></span>
            </div>

            <button type="submit" disabled={isReadonly || busyAction === 'create-tournament'}>
              {busyAction === 'create-tournament' ? 'Creando...' : 'Crear y activar torneo'}
            </button>
          </form>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <Rocket size={18} />
            <div>
              <h4>Registrar equipo</h4>
              <p>El roster se ve mejor cuando el torneo y el nombre oficial del equipo quedan limpios desde el principio.</p>
            </div>
          </div>

          <form className={styles.form} onSubmit={handleAddTeam}>
            <div className={styles.inputGrid}>
              <label>
                Torneo
                <select
                  value={teamTournamentId}
                  onChange={(event) => setTeamTournamentId(event.target.value)}
                  required
                >
                  <option value="">Selecciona un torneo</option>
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Nombre del equipo
                <input
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="Bandits"
                  required
                />
              </label>
            </div>

            <button type="submit" disabled={isReadonly || busyAction === 'add-team' || !teamTournament}>
              {busyAction === 'add-team' ? 'Agregando...' : 'Guardar equipo'}
            </button>
          </form>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <UserPlus size={18} />
            <div>
              <h4>Registrar jugador</h4>
              <p>
                Esta alta ahora separa nombre competitivo e identidad Discord. El lider debe quedar
                con Discord ID real para evitar suplantaciones.
              </p>
            </div>
          </div>

          <form className={styles.form} onSubmit={handleAddPlayer}>
            <div className={styles.formSection}>
              <div className={styles.formSectionHead}>
                <ShieldCheck size={16} />
                <div>
                  <strong>Ubicacion del roster</strong>
                  <span>Selecciona primero el torneo y el equipo correctos.</span>
                </div>
              </div>

              <div className={styles.inputGrid}>
                <label>
                  Torneo
                  <select
                    value={playerTournamentId}
                    onChange={(event) => {
                      setPlayerTournamentId(event.target.value);
                      setPlayerTeamName('');
                    }}
                    required
                  >
                    <option value="">Selecciona un torneo</option>
                    {tournaments.map((tournament) => (
                      <option key={tournament.id} value={tournament.id}>
                        {tournament.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Equipo
                  <select
                    value={playerTeamName}
                    onChange={(event) => setPlayerTeamName(event.target.value)}
                    required
                  >
                    <option value="">Selecciona un equipo</option>
                    {playerTeams.map((team) => (
                      <option key={team.name} value={team.name}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className={styles.formSection}>
              <div className={styles.formSectionHead}>
                <IdCard size={16} />
                <div>
                  <strong>Identidad del jugador</strong>
                  <span>El nombre competitivo va separado de la cuenta Discord para proteger el roster.</span>
                </div>
              </div>

              <div className={styles.inputGrid}>
                <label className={styles.fieldWide}>
                  Nombre competitivo
                  <input
                    value={playerForm.name}
                    onChange={(event) => updatePlayerField('name', event.target.value)}
                    placeholder="Tephy"
                    required
                  />
                </label>

                <label>
                  Discord ID
                  <input
                    value={playerForm.discordId}
                    onChange={(event) => updatePlayerField('discordId', event.target.value)}
                    placeholder="123456789012345678"
                  />
                </label>

                <label>
                  Nombre de Discord
                  <input
                    value={playerForm.discordUsername}
                    onChange={(event) => updatePlayerField('discordUsername', event.target.value)}
                    placeholder="@tephygg o tephygg#1234"
                  />
                </label>

                <label className={`${styles.checkboxCard} ${styles.fieldWide}`}>
                  <input
                    type="checkbox"
                    checked={playerForm.isLeader}
                    onChange={(event) => updatePlayerField('isLeader', event.target.checked)}
                  />
                  <div>
                    <strong>Marcar como lider del equipo</strong>
                    <span>Los lideres deben tener Discord ID valido para reportes y control operativo.</span>
                  </div>
                </label>
              </div>

              <div className={`${styles.identityState} ${styles[`state_${playerFormError ? 'error' : identityFeedback.tone}`] || ''}`}>
                <strong>Estado de identidad</strong>
                <span>{playerFormError || identityFeedback.message}</span>
              </div>

              <div className={styles.footerHint}>
                <span>Verificado fuerte: <code>Discord ID</code></span>
                <span>Provisional: <code>Discord username</code></span>
              </div>
            </div>

            <button type="submit" disabled={isReadonly || busyAction === 'add-player' || !playerTournament}>
              {busyAction === 'add-player' ? 'Guardando...' : 'Guardar jugador'}
            </button>
          </form>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <FileSpreadsheet size={18} />
            <div>
              <h4>Importar Excel o CSV</h4>
              <p>Usa importacion masiva para eventos grandes y luego ajusta identidades sensibles desde el CRM.</p>
            </div>
          </div>

          <form className={styles.form} onSubmit={handleImport}>
            <div className={styles.inputGrid}>
              <label className={styles.fieldWide}>
                Archivo
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(event) => setImportFile(event.target.files?.[0] || null)}
                  required
                />
              </label>

              <label className={styles.checkboxCard}>
                <input
                  type="checkbox"
                  checked={importActive}
                  onChange={(event) => setImportActive(event.target.checked)}
                />
                <div>
                  <strong>Activar el primer torneo importado</strong>
                  <span>Util para pruebas o para publicar el evento apenas entre al CRM.</span>
                </div>
              </label>
            </div>

            <button type="submit" disabled={isReadonly || busyAction === 'import-file'}>
              {busyAction === 'import-file' ? 'Importando...' : 'Importar archivo'}
            </button>
          </form>

          <div className={styles.links}>
            <a href="/template.xlsx">
              <Download size={16} />
              Plantilla Excel
            </a>
            <a href="/template.csv">
              <Download size={16} />
              Plantilla CSV
            </a>
            <a href="/tournament" target="_blank" rel="noreferrer">
              Endpoint activo
            </a>
          </div>
        </section>
      </div>
    </aside>
  );
}
