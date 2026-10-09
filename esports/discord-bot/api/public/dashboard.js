(function initDashboard() {
  const data = window.__GG_DASHBOARD__ || {};
  const tournaments = Array.isArray(data.tournaments) ? data.tournaments : [];

  const statusEl = document.getElementById('status');
  const helpDialog = document.getElementById('help-dialog');
  const helpOpen = document.getElementById('help-open');
  const helpClose = document.getElementById('help-close');
  const searchInput = document.getElementById('global-search');
  const themeToggle = document.getElementById('theme-toggle');
  const teamTournamentSelect = document.getElementById('team-tournament');
  const playerTournamentSelect = document.getElementById('player-tournament');
  const playerTeamSelect = document.getElementById('player-team');
  const demoButton = document.getElementById('demo-load');
  const searchEmpty = document.getElementById('search-empty');

  function setStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.style.color = isError ? 'var(--danger)' : 'var(--accent-strong)';
  }

  function getTournamentById(id) {
    return tournaments.find((tournament) => tournament.id === id);
  }

  function fillTeamsForTournament(tournamentId) {
    const tournament = getTournamentById(tournamentId);
    const teams = tournament ? tournament.teams : [];

    if (!teams.length) {
      playerTeamSelect.innerHTML = '<option value="">Primero crea un equipo en ese torneo</option>';
      return;
    }

    playerTeamSelect.innerHTML = teams
      .map((team) => '<option value="' + team.name.replace(/"/g, '&quot;') + '">' + team.name + '</option>')
      .join('');
  }

  function applySearch() {
    const query = searchInput.value.trim().toLowerCase();
    const items = document.querySelectorAll('.searchable');
    let visibleItems = 0;

    items.forEach((item) => {
      const haystack = String(item.dataset.search || '').toLowerCase();
      const isVisible = !query || haystack.includes(query);
      item.hidden = !isVisible;

      if (isVisible) {
        visibleItems += 1;
      }
    });

    searchEmpty.classList.toggle('is-visible', visibleItems === 0);
  }

  function getPreferredTheme() {
    const saved = window.localStorage.getItem('gg-theme');

    if (saved === 'light' || saved === 'dark') {
      return saved;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    themeToggle.textContent = theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
    window.localStorage.setItem('gg-theme', theme);
  }

  async function submitJson(url, payload) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'No se pudo completar la accion.');
    }

    return data;
  }

  playerTournamentSelect.addEventListener('change', (event) => {
    fillTeamsForTournament(event.target.value);
  });

  searchInput.addEventListener('input', applySearch);

  themeToggle.addEventListener('click', () => {
    applyTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  document.getElementById('tournament-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('Creando torneo...', false);

    try {
      await submitJson('/tournament', {
        name: document.getElementById('tournament-name').value.trim(),
        makeActive: document.getElementById('tournament-active').checked,
      });
      setStatus('Torneo creado. Recargando...', false);
      window.location.reload();
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  document.getElementById('team-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('Agregando equipo...', false);

    try {
      await submitJson('/team', {
        tournamentId: teamTournamentSelect.value,
        teamName: document.getElementById('team-name').value.trim(),
      });
      setStatus('Equipo agregado. Recargando...', false);
      window.location.reload();
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  document.getElementById('player-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('Agregando jugador...', false);

    try {
      await submitJson('/player', {
        tournamentId: playerTournamentSelect.value,
        teamName: playerTeamSelect.value,
        player: {
          name: document.getElementById('player-name').value.trim(),
          discordId: document.getElementById('player-discord-id').value.trim(),
          isLeader: document.getElementById('player-is-leader').checked,
        },
      });
      setStatus('Jugador agregado. Recargando...', false);
      window.location.reload();
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  demoButton.addEventListener('click', async () => {
    setStatus('Cargando torneo demo...', false);

    try {
      await submitJson('/demo/load', {});
      setStatus('Demo cargada. Recargando...', false);
      window.location.reload();
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  document.getElementById('import-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('Importando archivo...', false);

    try {
      const formData = new FormData();
      const fileInput = document.getElementById('import-file');
      formData.append('file', fileInput.files[0]);
      formData.append('makeActive', document.getElementById('import-active').checked ? 'true' : 'false');

      const response = await fetch('/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo importar el archivo.');
      }

      setStatus('Importacion completada. Recargando...', false);
      window.location.reload();
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  document.querySelectorAll('[data-action="activate"]').forEach((button) => {
    button.addEventListener('click', async () => {
      setStatus('Cambiando torneo activo...', false);

      try {
        await submitJson('/tournament/activate', {
          tournamentId: button.dataset.tournamentId,
        });
        setStatus('Torneo activo actualizado. Recargando...', false);
        window.location.reload();
      } catch (error) {
        setStatus(error.message, true);
      }
    });
  });

  helpOpen.addEventListener('click', () => {
    helpDialog.showModal();
  });

  helpClose.addEventListener('click', () => {
    helpDialog.close();
  });

  applyTheme(getPreferredTheme());
  fillTeamsForTournament(playerTournamentSelect.value);
  applySearch();
})();
