const STATIC_UNIVERSITY_VERIFICATION_RULES = {
  uasd:      { allowedDomains: ['uasd.edu.do'],                        allowedTenantIds: [] },
  pucmm:     { allowedDomains: ['pucmm.edu.do'],                       allowedTenantIds: [] },
  intec:     { allowedDomains: ['intec.edu.do'],                       allowedTenantIds: [] },
  unibe:     { allowedDomains: ['unibe.edu.do'],                       allowedTenantIds: [] },
  itla:      { allowedDomains: ['itla.edu.do'],                        allowedTenantIds: [] },
  unapec:    { allowedDomains: ['unapec.edu.do'],                      allowedTenantIds: [] },
  unphu:     { allowedDomains: ['unphu.edu.do'],                       allowedTenantIds: [] },
  utesa:     { allowedDomains: ['utesa.edu'],                          allowedTenantIds: [] },
  uapa:      { allowedDomains: ['uapa.edu.do'],                        allowedTenantIds: [] },
  ucne:      { allowedDomains: ['ucne.edu'],                           allowedTenantIds: [] },
  isfodosu:  { allowedDomains: ['isfodosu.edu.do'],                    allowedTenantIds: [] },
  itsc:      { allowedDomains: ['itsc.edu.do'],                        allowedTenantIds: [] },
  ucateci:   { allowedDomains: ['ucateci.edu.do'],                     allowedTenantIds: [] },
  uniremhos: { allowedDomains: ['uniremhos.edu.do'],                   allowedTenantIds: [] },
  unicaribe: { allowedDomains: ['unicaribe.edu.do'],                   allowedTenantIds: [] },
  oym:       { allowedDomains: ['udoym.edu.do', 'oymas.edu.do', 'oym.edu.do'], allowedTenantIds: [] },
  uce:       { allowedDomains: ['uce.edu.do', 'aluce.edu.do'],         allowedTenantIds: [] },
  ufhec:     { allowedDomains: ['ufhec.edu.do'],                       allowedTenantIds: [] },
  ucsd:      { allowedDomains: ['ucsd.edu.do'],                        allowedTenantIds: [] },
  loyola:    { allowedDomains: ['loyola.edu.do'],                      allowedTenantIds: [] },
}

const normalizeText = (value, max = 120) => String(value || '').trim().slice(0, max)

const normalizeArray = (value = []) => {
  if (!Array.isArray(value)) return []
  return value.map((item) => normalizeText(item, 160).toLowerCase()).filter(Boolean)
}

const parseEnvUniversityRules = () => {
  const raw = String(process.env.UNIVERSITY_VERIFICATION_RULES_JSON || '').trim()
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.entries(parsed).reduce((acc, [universityId, value]) => {
      const key = normalizeText(universityId, 60).toLowerCase()
      if (!key || !value || typeof value !== 'object' || Array.isArray(value)) return acc
      acc[key] = {
        allowedDomains: normalizeArray(value.allowedDomains),
        allowedTenantIds: normalizeArray(value.allowedTenantIds),
      }
      return acc
    }, {})
  } catch (error) {
    console.error('Invalid UNIVERSITY_VERIFICATION_RULES_JSON:', error.message)
    return {}
  }
}

export const getUniversityVerificationRule = (universityId = '') => {
  const key = normalizeText(universityId, 60).toLowerCase()
  if (!key) return { allowedDomains: [], allowedTenantIds: [] }
  const envRules = parseEnvUniversityRules()
  const staticRule = STATIC_UNIVERSITY_VERIFICATION_RULES[key] || {}
  const envRule = envRules[key] || {}
  return {
    allowedDomains:  Array.from(new Set([...(staticRule.allowedDomains  || []), ...(envRule.allowedDomains  || [])])),
    allowedTenantIds: Array.from(new Set([...(staticRule.allowedTenantIds || []), ...(envRule.allowedTenantIds || [])])),
  }
}

export const getUniversityAllowedDomains = (universityId = '') =>
  getUniversityVerificationRule(universityId).allowedDomains

export const hasUniversityVerificationRule = (universityId = '') =>
  getUniversityAllowedDomains(universityId).length > 0

export const isUniversityDomainAllowed = (universityId = '', emailOrDomain = '') => {
  const rule = getUniversityVerificationRule(universityId)
  const value = normalizeText(emailOrDomain, 160).toLowerCase()
  const domain = value.includes('@') ? value.split('@').pop() : value
  if (!domain || rule.allowedDomains.length === 0) return false
  // Acepta subdominios (ej. est.intec.edu.do para intec.edu.do)
  return rule.allowedDomains.some((d) => domain === d || domain.endsWith(`.${d}`))
}

// Used during Microsoft OAuth callback to decide auto-approval eligibility
export const evaluateUniversityMicrosoftAllowlist = ({
  universityId = '',
  institutionalEmail = '',
  microsoftEmail = '',
  microsoftTenantId = '',
}) => {
  const rule = getUniversityVerificationRule(universityId)
  const instDomain = normalizeText(institutionalEmail, 160).toLowerCase().split('@').pop() || ''
  const msDomain   = normalizeText(microsoftEmail,     160).toLowerCase().split('@').pop() || ''
  const tenantId   = normalizeText(microsoftTenantId,  120).toLowerCase()

  const hasDomainRules  = rule.allowedDomains.length  > 0
  const hasTenantRules  = rule.allowedTenantIds.length > 0

  const allowedByDomain = hasDomainRules
    ? Boolean(instDomain && msDomain && rule.allowedDomains.includes(instDomain) && rule.allowedDomains.includes(msDomain))
    : false

  const allowedByTenant = hasTenantRules
    ? Boolean(tenantId && rule.allowedTenantIds.includes(tenantId))
    : false

  // Eligible for auto-approve when domain rules match and tenant rules also match (or there are none)
  const autoApproveEligible = hasDomainRules && allowedByDomain && (!hasTenantRules || allowedByTenant)

  return { rule, instDomain, msDomain, hasDomainRules, hasTenantRules, allowedByDomain, allowedByTenant, autoApproveEligible }
}

// Devuelve el id de la universidad cuyo dominio institucional coincide con el correo.
export const findUniversityIdByEmail = (email = '') =>
  Object.keys(STATIC_UNIVERSITY_VERIFICATION_RULES).find((id) => isUniversityDomainAllowed(id, email)) || ''
