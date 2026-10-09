function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPlan(plan) {
  return `
    <article class="plan-card">
      <div class="plan-head">
        <span class="pill">${escapeHtml(plan.id)}</span>
        <strong>${escapeHtml(plan.name)}</strong>
      </div>
      <p>${escapeHtml(plan.description)}</p>
      <div class="price">$${escapeHtml(plan.monthlyPrice)}<span>/mes</span></div>
      <ul>
        <li>Comision: ${escapeHtml(plan.commissionRate)}%</li>
        <li>Requests al mes: ${escapeHtml(plan.requestLimit)}</li>
        <li>Rate limit: ${escapeHtml(plan.rateLimitPerMinute)}/min</li>
        <li>Scopes: ${escapeHtml(plan.capabilities.join(', '))}</li>
      </ul>
    </article>
  `;
}

function renderEndpoint(endpoint) {
  return `
    <article class="endpoint">
      <div class="endpoint-top">
        <span class="method">${escapeHtml(endpoint.method)}</span>
        <code>${escapeHtml(endpoint.path)}</code>
      </div>
      <p>${escapeHtml(endpoint.description)}</p>
      <small>Scope: ${escapeHtml(endpoint.capability)}</small>
    </article>
  `;
}

function renderDeveloperPortal({ catalog, docs }) {
  const plans = Array.isArray(catalog?.plans) ? catalog.plans : [];
  const endpoints = Array.isArray(docs?.endpoints) ? docs.endpoints : [];

  return `<!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(catalog?.brand || 'GlitchGang API')}</title>
      <style>
        :root {
          color-scheme: dark;
          --bg: #09111a;
          --surface: rgba(255,255,255,0.05);
          --surface-strong: rgba(255,255,255,0.08);
          --text: #ecf2ff;
          --muted: rgba(220,230,255,0.72);
          --border: rgba(255,255,255,0.1);
          --cyan: #38d9c8;
          --red: #ff5c5c;
          --green: #4ade80;
          --blue: #5b8def;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Inter, Segoe UI, sans-serif;
          background:
            radial-gradient(circle at top left, rgba(56,217,200,0.18), transparent 35%),
            radial-gradient(circle at top right, rgba(91,141,239,0.18), transparent 25%),
            linear-gradient(180deg, #09111a, #0f1824);
          color: var(--text);
        }
        .shell {
          max-width: 1160px;
          margin: 0 auto;
          padding: 48px 20px 72px;
        }
        .hero {
          display: grid;
          grid-template-columns: 1.3fr 0.9fr;
          gap: 24px;
          margin-bottom: 28px;
        }
        .hero-card, .panel {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 28px;
          backdrop-filter: blur(18px);
        }
        h1, h2, h3, p { margin-top: 0; }
        h1 {
          font-size: clamp(2.2rem, 5vw, 4rem);
          line-height: 1;
          margin-bottom: 14px;
        }
        .lead {
          color: var(--muted);
          line-height: 1.7;
          max-width: 720px;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 22px;
        }
        .stat {
          padding: 16px;
          border-radius: 18px;
          background: var(--surface-strong);
          border: 1px solid var(--border);
        }
        .stat strong {
          display: block;
          font-size: 1.45rem;
          margin-bottom: 6px;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(56,217,200,0.12);
          color: var(--cyan);
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 16px;
        }
        .actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
        }
        .actions a {
          text-decoration: none;
          color: #04121a;
          background: var(--cyan);
          padding: 12px 18px;
          border-radius: 14px;
          font-weight: 700;
        }
        .actions a.secondary {
          color: var(--text);
          background: transparent;
          border: 1px solid var(--border);
        }
        .code {
          margin-top: 18px;
          padding: 16px;
          border-radius: 18px;
          background: rgba(0,0,0,0.26);
          border: 1px solid var(--border);
          overflow: auto;
          white-space: pre-wrap;
          font-family: Consolas, monospace;
          color: #d7f5ee;
        }
        .plan-grid, .endpoint-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 18px;
        }
        .plan-card, .endpoint {
          padding: 20px;
          background: var(--surface);
          border-radius: 22px;
          border: 1px solid var(--border);
        }
        .plan-head, .endpoint-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .price {
          font-size: 2rem;
          font-weight: 800;
          margin: 14px 0;
        }
        .price span {
          font-size: 0.95rem;
          color: var(--muted);
          margin-left: 6px;
        }
        ul {
          padding-left: 18px;
          color: var(--muted);
          line-height: 1.7;
        }
        .endpoint code {
          color: #d7f5ee;
          font-size: 0.95rem;
        }
        .method {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          border-radius: 999px;
          font-weight: 700;
          background: rgba(74,222,128,0.14);
          color: var(--green);
        }
        .footer {
          margin-top: 28px;
          padding: 22px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border);
          color: var(--muted);
          line-height: 1.7;
        }
        @media (max-width: 860px) {
          .hero {
            grid-template-columns: 1fr;
          }
          .stats {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <div class="shell">
        <section class="hero">
          <div class="hero-card">
            <span class="pill">GlitchGang API</span>
            <h1>Convierte torneos, rosters y reportes en producto.</h1>
            <p class="lead">
              GlitchGang ya puede operar como proveedor API para terceros. Esta pagina expone
              planes, scopes, autenticacion y el modelo comercial para ligas, agencias, marcas o
              paneles externos que quieran consumir la data del ecosistema.
            </p>
            <p class="lead">
              Los torneos creados por GlitchGang pueden usar el bot sin costo. Los terceros entran
              por fee por torneo o por comision, segun el acuerdo comercial.
            </p>
            <div class="actions">
              <a href="${escapeHtml(catalog?.docsUrl || '/api/public/docs')}">Ver docs JSON</a>
              <a class="secondary" href="/">Entrar al CRM</a>
            </div>
            <div class="code">curl -H "x-api-key: TU_API_KEY" ${escapeHtml('/api/v1/tournaments/active')}</div>
          </div>

          <div class="panel">
            <h2>Operacion comercial</h2>
            <p class="lead">Modelo actual: ${escapeHtml(catalog?.payoutModel || '')}</p>
            <div class="stats">
              <div class="stat">
                <strong>${escapeHtml(catalog?.metrics?.activePartners || 0)}</strong>
                <span>Partners activos</span>
              </div>
              <div class="stat">
                <strong>$${escapeHtml(catalog?.metrics?.monthlyRevenue || 0)}</strong>
                <span>MRR configurado</span>
              </div>
              <div class="stat">
                <strong>${escapeHtml(catalog?.metrics?.monthlyRequests || 0)}</strong>
                <span>Requests este mes</span>
              </div>
              <div class="stat">
                <strong>${escapeHtml(catalog?.metrics?.avgCommission || 0)}%</strong>
                <span>Comision promedio</span>
              </div>
            </div>
          </div>
        </section>

        <section class="panel" style="margin-bottom: 24px;">
          <h2>Planes disponibles</h2>
          <div class="plan-grid">
            ${plans.map(renderPlan).join('')}
          </div>
        </section>

        <section class="panel">
          <h2>Endpoints publicados</h2>
          <div class="endpoint-grid">
            ${endpoints.map(renderEndpoint).join('')}
          </div>
        </section>

        <section class="footer">
          <strong>Soporte:</strong> ${escapeHtml(catalog?.supportEmail || '')}<br />
          <strong>Portal de developers:</strong> ${escapeHtml(catalog?.developerPortalUrl || '/developers')}<br />
          <strong>Autenticacion:</strong> header <code>${escapeHtml(docs?.auth?.header || 'x-api-key')}</code> o <code>Authorization: Bearer ...</code>
        </section>
      </div>
    </body>
  </html>`;
}

module.exports = { renderDeveloperPortal };
