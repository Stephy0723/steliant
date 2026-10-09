function serializeForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function renderDashboard(payload = {}) {
  return `<!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>GlitchGang Control Center</title>
      <meta
        name="description"
        content="Control Center premium para CRM de torneos, check-in, partidas y reportes de GlitchGang Bot."
      />
      <link rel="stylesheet" href="/app/dashboard.css" />
    </head>
    <body>
      <div id="root"></div>
      <script>
        window.__GG_BOOTSTRAP__ = ${serializeForScript(payload)};
      </script>
      <script type="module" src="/app/dashboard.js"></script>
    </body>
  </html>`;
}

module.exports = { renderDashboard };
