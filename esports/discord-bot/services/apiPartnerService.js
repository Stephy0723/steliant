const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'api-clients.json');

const DEFAULT_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 0,
    commissionRate: 15,
    requestLimit: 1000,
    rateLimitPerMinute: 30,
    capabilities: ['tournaments:read'],
    description: 'Ideal para pruebas, integraciones pequenas y validacion inicial.',
  },
  {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 49,
    commissionRate: 12,
    requestLimit: 25000,
    rateLimitPerMinute: 120,
    capabilities: ['tournaments:read', 'tournaments:write', 'activity:read', 'reports:read'],
    description: 'Pensado para agencias, ligas y marcas que necesitan operacion continua.',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 149,
    commissionRate: 8,
    requestLimit: 100000,
    rateLimitPerMinute: 300,
    capabilities: ['tournaments:read', 'tournaments:write', 'activity:read', 'reports:read'],
    description: 'Cobertura completa para partners con alto volumen y soporte prioritario.',
  },
];

const DEFAULT_SETTINGS = {
  brandName: 'GlitchGang API',
  supportEmail: 'partners@glitchgang.gg',
  payoutModel: 'Fee por torneo o comision; cobro principal por PayPal segun plan acordado.',
  docsUrl: '/api/public/docs',
  catalogUrl: '/api/public/catalog',
  developerPortalUrl: '/developers',
  internalUsagePolicy: 'Los torneos creados por GlitchGang pueden usar el bot gratis; terceros pagan fee por torneo o comision y el cobro se gestiona por PayPal.',
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureStore() {
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(
      FILE,
      JSON.stringify({ plans: DEFAULT_PLANS, partners: [], settings: DEFAULT_SETTINGS }, null, 2),
      'utf8'
    );
  }
}

function normalizeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase() === 'paused' ? 'paused' : 'active';
}

function normalizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function buildApiKey() {
  return `gg_live_${crypto.randomBytes(24).toString('hex')}`;
}

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(String(apiKey || '')).digest('hex');
}

function maskApiKey(apiKey) {
  const raw = String(apiKey || '');
  if (raw.length <= 16) {
    return raw;
  }

  return `${raw.slice(0, 12)}...${raw.slice(-4)}`;
}

function sanitizePartner(partner) {
  const copy = clone(partner);
  delete copy.apiKeyHash;
  return copy;
}

function normalizePlan(plan, index) {
  const fallback = DEFAULT_PLANS[index] || DEFAULT_PLANS[0];

  return {
    id: normalizeText(plan?.id, fallback.id),
    name: normalizeText(plan?.name, fallback.name),
    monthlyPrice: normalizeNumber(plan?.monthlyPrice, fallback.monthlyPrice),
    commissionRate: normalizeNumber(plan?.commissionRate, fallback.commissionRate),
    requestLimit: normalizeNumber(plan?.requestLimit, fallback.requestLimit),
    rateLimitPerMinute: normalizeNumber(plan?.rateLimitPerMinute, fallback.rateLimitPerMinute),
    capabilities: Array.isArray(plan?.capabilities) && plan.capabilities.length
      ? plan.capabilities.map((entry) => normalizeText(entry)).filter(Boolean)
      : [...fallback.capabilities],
    description: normalizeText(plan?.description, fallback.description),
  };
}

function normalizeUsage(usage = {}) {
  return {
    monthKey: normalizeText(usage.monthKey, getMonthKey()),
    currentMonthRequests: normalizeNumber(usage.currentMonthRequests, 0),
    totalRequests: normalizeNumber(usage.totalRequests, 0),
    lastRequestAt: usage.lastRequestAt || null,
    lastEndpoint: usage.lastEndpoint || '',
  };
}

function normalizePartner(partner, plans, index) {
  const fallbackPlan = plans.find((entry) => entry.id === normalizeText(partner?.planId))
    || plans[0]
    || DEFAULT_PLANS[0];
  const createdAt = partner?.createdAt || new Date().toISOString();
  const updatedAt = partner?.updatedAt || createdAt;

  return {
    id: normalizeText(partner?.id, `partner_${Date.now()}_${index}`),
    companyName: normalizeText(partner?.companyName, `Partner ${index + 1}`),
    contactName: normalizeText(partner?.contactName, 'Sin contacto'),
    email: normalizeText(partner?.email, ''),
    appName: normalizeText(partner?.appName, 'GlitchGang Client'),
    callbackUrl: normalizeText(partner?.callbackUrl, ''),
    planId: fallbackPlan.id,
    status: normalizeStatus(partner?.status),
    monthlyPrice: normalizeNumber(partner?.monthlyPrice, fallbackPlan.monthlyPrice),
    commissionRate: normalizeNumber(partner?.commissionRate, fallbackPlan.commissionRate),
    requestLimit: normalizeNumber(partner?.requestLimit, fallbackPlan.requestLimit),
    rateLimitPerMinute: normalizeNumber(partner?.rateLimitPerMinute, fallbackPlan.rateLimitPerMinute),
    capabilities: Array.isArray(partner?.capabilities) && partner.capabilities.length
      ? partner.capabilities.map((entry) => normalizeText(entry)).filter(Boolean)
      : [...fallbackPlan.capabilities],
    apiKeyHash: normalizeText(partner?.apiKeyHash, ''),
    apiKeyPreview: normalizeText(partner?.apiKeyPreview, ''),
    apiKeyLast4: normalizeText(partner?.apiKeyLast4, ''),
    createdAt,
    updatedAt,
    lastKeyRotatedAt: partner?.lastKeyRotatedAt || createdAt,
    usage: normalizeUsage(partner?.usage),
  };
}

function normalizeStore(raw) {
  const plans = Array.isArray(raw?.plans) && raw.plans.length
    ? raw.plans.map(normalizePlan)
    : clone(DEFAULT_PLANS);

  const partners = Array.isArray(raw?.partners)
    ? raw.partners.map((partner, index) => normalizePartner(partner, plans, index))
    : [];

  return {
    plans,
    partners,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(raw?.settings || {}),
    },
  };
}

function loadPartnerStore() {
  ensureStore();
  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const normalized = normalizeStore(raw);

  if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
    fs.writeFileSync(FILE, JSON.stringify(normalized, null, 2), 'utf8');
  }

  return normalized;
}

function savePartnerStore(store) {
  const normalized = normalizeStore(store);
  fs.writeFileSync(FILE, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

function getPlanById(planId, plans) {
  return plans.find((plan) => plan.id === normalizeText(planId));
}

function buildMetrics(store) {
  const activePartners = store.partners.filter((partner) => partner.status === 'active');
  const monthlyRevenue = activePartners.reduce(
    (total, partner) => total + normalizeNumber(partner.monthlyPrice, 0),
    0
  );
  const requestVolume = store.partners.reduce(
    (total, partner) => total + normalizeNumber(partner.usage?.currentMonthRequests, 0),
    0
  );
  const avgCommission = activePartners.length
    ? Math.round(
      activePartners.reduce((total, partner) => total + normalizeNumber(partner.commissionRate, 0), 0)
      / activePartners.length
    )
    : 0;

  return {
    partners: store.partners.length,
    activePartners: activePartners.length,
    monthlyRevenue,
    avgCommission,
    monthlyRequests: requestVolume,
  };
}

function getApiHubSnapshot() {
  const store = loadPartnerStore();

  return {
    plans: store.plans,
    partners: store.partners.map(sanitizePartner),
    settings: store.settings,
    metrics: buildMetrics(store),
  };
}

function createPartner(payload = {}) {
  const store = loadPartnerStore();
  const plan = getPlanById(payload.planId, store.plans) || store.plans[0];

  if (!plan) {
    return { error: 'No hay planes configurados para crear clientes API.' };
  }

  const companyName = normalizeText(payload.companyName, '');
  if (!companyName) {
    return { error: 'La empresa o partner necesita un nombre.' };
  }

  const apiKey = buildApiKey();
  const now = new Date().toISOString();
  const partner = {
    id: `partner_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    companyName,
    contactName: normalizeText(payload.contactName, 'Sin contacto'),
    email: normalizeText(payload.email, ''),
    appName: normalizeText(payload.appName, `${companyName} App`),
    callbackUrl: normalizeText(payload.callbackUrl, ''),
    planId: plan.id,
    status: 'active',
    monthlyPrice: normalizeNumber(payload.monthlyPrice, plan.monthlyPrice),
    commissionRate: normalizeNumber(payload.commissionRate, plan.commissionRate),
    requestLimit: plan.requestLimit,
    rateLimitPerMinute: plan.rateLimitPerMinute,
    capabilities: [...plan.capabilities],
    apiKeyHash: hashApiKey(apiKey),
    apiKeyPreview: maskApiKey(apiKey),
    apiKeyLast4: apiKey.slice(-4),
    createdAt: now,
    updatedAt: now,
    lastKeyRotatedAt: now,
    usage: normalizeUsage(),
  };

  store.partners.unshift(partner);
  savePartnerStore(store);

  return {
    partner: sanitizePartner(partner),
    apiKey,
  };
}

function updatePartner(partnerId, payload = {}) {
  const store = loadPartnerStore();
  const partner = store.partners.find((entry) => entry.id === normalizeText(partnerId));

  if (!partner) {
    return { error: 'Cliente API no encontrado.' };
  }

  const nextPlan = payload.planId
    ? getPlanById(payload.planId, store.plans)
    : getPlanById(partner.planId, store.plans);

  if (!nextPlan) {
    return { error: 'El plan indicado no existe.' };
  }

  partner.companyName = normalizeText(payload.companyName, partner.companyName);
  partner.contactName = normalizeText(payload.contactName, partner.contactName);
  partner.email = normalizeText(payload.email, partner.email);
  partner.appName = normalizeText(payload.appName, partner.appName);
  partner.callbackUrl = normalizeText(payload.callbackUrl, partner.callbackUrl);
  partner.status = payload.status ? normalizeStatus(payload.status) : partner.status;
  partner.planId = nextPlan.id;
  partner.requestLimit = nextPlan.requestLimit;
  partner.rateLimitPerMinute = nextPlan.rateLimitPerMinute;
  partner.capabilities = [...nextPlan.capabilities];
  partner.monthlyPrice = Object.prototype.hasOwnProperty.call(payload, 'monthlyPrice')
    ? normalizeNumber(payload.monthlyPrice, nextPlan.monthlyPrice)
    : nextPlan.monthlyPrice;
  partner.commissionRate = Object.prototype.hasOwnProperty.call(payload, 'commissionRate')
    ? normalizeNumber(payload.commissionRate, nextPlan.commissionRate)
    : nextPlan.commissionRate;
  partner.updatedAt = new Date().toISOString();

  savePartnerStore(store);
  return { partner: sanitizePartner(partner) };
}

function rotatePartnerKey(partnerId) {
  const store = loadPartnerStore();
  const partner = store.partners.find((entry) => entry.id === normalizeText(partnerId));

  if (!partner) {
    return { error: 'Cliente API no encontrado.' };
  }

  const apiKey = buildApiKey();
  const now = new Date().toISOString();

  partner.apiKeyHash = hashApiKey(apiKey);
  partner.apiKeyPreview = maskApiKey(apiKey);
  partner.apiKeyLast4 = apiKey.slice(-4);
  partner.lastKeyRotatedAt = now;
  partner.updatedAt = now;

  savePartnerStore(store);

  return {
    partner: sanitizePartner(partner),
    apiKey,
  };
}

function authorizeApiClient(apiKey, capability) {
  const store = loadPartnerStore();
  const hashedKey = hashApiKey(apiKey);
  const partner = store.partners.find((entry) => entry.apiKeyHash === hashedKey);

  if (!partner) {
    return { error: 'API key invalida.' };
  }

  if (partner.status !== 'active') {
    return { error: 'La API key esta pausada.' };
  }

  if (capability && !partner.capabilities.includes(capability)) {
    return { error: 'Tu plan no tiene acceso a este endpoint.' };
  }

  const usage = normalizeUsage(partner.usage);
  const monthKey = getMonthKey();

  if (usage.monthKey !== monthKey) {
    usage.monthKey = monthKey;
    usage.currentMonthRequests = 0;
  }

  if (usage.currentMonthRequests >= partner.requestLimit) {
    return { error: 'Limite mensual de requests alcanzado.', statusCode: 429 };
  }

  return {
    partner,
  };
}

function recordApiUsage(partnerId, endpoint) {
  const store = loadPartnerStore();
  const partner = store.partners.find((entry) => entry.id === normalizeText(partnerId));

  if (!partner) {
    return null;
  }

  const usage = normalizeUsage(partner.usage);
  const monthKey = getMonthKey();

  if (usage.monthKey !== monthKey) {
    usage.monthKey = monthKey;
    usage.currentMonthRequests = 0;
  }

  usage.currentMonthRequests += 1;
  usage.totalRequests += 1;
  usage.lastRequestAt = new Date().toISOString();
  usage.lastEndpoint = normalizeText(endpoint);
  partner.usage = usage;

  savePartnerStore(store);
  return sanitizePartner(partner);
}

function getPublicApiCatalog() {
  const snapshot = getApiHubSnapshot();

  return {
    brand: snapshot.settings.brandName,
    supportEmail: snapshot.settings.supportEmail,
    payoutModel: snapshot.settings.payoutModel,
    internalUsagePolicy: snapshot.settings.internalUsagePolicy,
    docsUrl: snapshot.settings.docsUrl,
    developerPortalUrl: snapshot.settings.developerPortalUrl,
    metrics: snapshot.metrics,
    plans: snapshot.plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      monthlyPrice: plan.monthlyPrice,
      commissionRate: plan.commissionRate,
      requestLimit: plan.requestLimit,
      rateLimitPerMinute: plan.rateLimitPerMinute,
      capabilities: plan.capabilities,
      description: plan.description,
    })),
  };
}

function getPublicApiDocs() {
  const catalog = getPublicApiCatalog();

  return {
    auth: {
      header: 'x-api-key',
      bearerSupported: true,
      example: 'x-api-key: gg_live_xxxxxxxxx',
    },
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/tournaments',
        capability: 'tournaments:read',
        description: 'Devuelve todos los torneos registrados en GlitchGang.',
      },
      {
        method: 'GET',
        path: '/api/v1/tournaments/active',
        capability: 'tournaments:read',
        description: 'Devuelve el torneo activo que usa el bot como referencia.',
      },
      {
        method: 'POST',
        path: '/api/v1/tournaments/sync',
        capability: 'tournaments:write',
        description: 'Sincroniza un torneo externo hacia GlitchGang CRM y deja el roster disponible para el bot.',
      },
      {
        method: 'GET',
        path: '/api/v1/activity',
        capability: 'activity:read',
        description: 'Entrega actividad reciente del CRM y eventos operativos.',
      },
      {
        method: 'GET',
        path: '/api/v1/reports',
        capability: 'reports:read',
        description: 'Entrega reportes registrados por equipos dentro del sistema.',
      },
    ],
    plans: catalog.plans,
    supportEmail: catalog.supportEmail,
  };
}

module.exports = {
  authorizeApiClient,
  createPartner,
  getApiHubSnapshot,
  getPublicApiCatalog,
  getPublicApiDocs,
  loadPartnerStore,
  recordApiUsage,
  rotatePartnerKey,
  savePartnerStore,
  updatePartner,
};
