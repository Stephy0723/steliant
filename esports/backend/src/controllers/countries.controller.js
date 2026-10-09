import { listCountries } from '../services/countries.service.js'

export async function getCountries(req, res, next) {
  try {
    res.json({ countries: await listCountries() })
  } catch (error) {
    next(error)
  }
}
