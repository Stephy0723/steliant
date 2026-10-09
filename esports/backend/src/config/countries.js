// Stable platform country order. RD is intentionally used for Dominican Republic.
const COUNTRY_CODES = [
  'RD','MX','AR',
  'AF','AL','DZ','AS','AD','AO','AI','AQ','AG','AM','AW','AX','AU','AT','AZ',
  'BS','BH','BD','BB','BY','BE','BZ','BJ','BM','BT','BO','BQ','BA','BW','BV','BR','IO','BN','BG','BF','BI',
  'CV','KH','CM','CA','KY','CF','TD','CL','CN','CX','CC','CO','KM','CG','CD','CK','CR','CI','HR','CU','CW','CY','CZ',
  'DK','DJ','DM',
  'EC','EG','SV','GQ','ER','EE','SZ','ET',
  'FK','FO','FJ','FI','FR','GF','PF','TF',
  'GA','GM','GE','DE','GH','GI','GR','GL','GD','GP','GU','GT','GG','GN','GW','GY',
  'HT','HM','VA','HN','HK','HU',
  'IS','IN','ID','IR','IQ','IE','IM','IL','IT',
  'JM','JP','JE','JO',
  'KZ','KE','KI','KP','KR','KW','KG',
  'LA','LV','LB','LS','LR','LY','LI','LT','LU',
  'MO','MG','MW','MY','MV','ML','MT','MH','MQ','MR','MU','YT','FM','MD','MC','MN','ME','MS','MA','MZ','MM',
  'NA','NR','NP','NL','NC','NZ','NI','NE','NG','NU','NF','MK','MP','NO',
  'OM',
  'PK','PW','PS','PA','PG','PY','PE','PH','PN','PL','PT','PR',
  'QA',
  'RE','RO','RU','RW',
  'BL','SH','KN','LC','MF','PM','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SX','SK','SI','SB','SO','ZA','GS','SS','ES','LK','SD','SR','SJ','SE','CH','SY',
  'TW','TJ','TZ','TH','TL','TG','TK','TO','TT','TN','TR','TM','TC','TV',
  'UG','UA','AE','GB','US','UM','UY','UZ',
  'VU','VE','VN','VG','VI',
  'WF','EH',
  'YE',
  'ZM','ZW',
]

export const COUNTRY_NUMBERS = Object.freeze(
  Object.fromEntries(COUNTRY_CODES.map((code, index) => [code, String(index + 1).padStart(2, '0')]))
)

export const COUNTRY_CODE_ALIASES = Object.freeze({ DO: 'RD' })

export function normalizeCountryCode(value = '') {
  const code = String(value).trim().toUpperCase()
  return COUNTRY_CODE_ALIASES[code] || code
}

export function getCountryNumber(code) {
  return COUNTRY_NUMBERS[normalizeCountryCode(code)]
}

export const COUNTRY_ENTRIES = Object.freeze(
  Object.entries(COUNTRY_NUMBERS).map(([code, number], index) => ({ id: index + 1, code, number }))
)
