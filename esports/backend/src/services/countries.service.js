import { config } from '../config/index.js'
import { COUNTRY_ENTRIES, getCountryNumber, normalizeCountryCode } from '../config/countries.js'
import { Country } from '../models/Country.js'

export async function seedCountries() {
  if (!config.mongoEnabled) return

  const stored = await Country.find({}, { id: 1, code: 1, number: 1, _id: 0 }).lean()
  const isCurrent = stored.length === COUNTRY_ENTRIES.length
    && stored.every(({ id, code, number }) => getCountryNumber(code) === number && Number(number) === id)

  if (!isCurrent) {
    await Country.deleteMany({})
    await Country.insertMany(COUNTRY_ENTRIES)
  }
}

export async function listCountries() {
  if (!config.mongoEnabled) return COUNTRY_ENTRIES

  return Country.find().sort({ id: 1 }).lean()
}

export function requireCountryNumber(countryCode) {
  const code = normalizeCountryCode(countryCode)
  const number = getCountryNumber(code)

  if (!number) {
    const error = new Error('Unsupported country code')
    error.status = 400
    throw error
  }

  return { code, number }
}
