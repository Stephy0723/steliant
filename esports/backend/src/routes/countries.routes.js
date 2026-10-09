import { Router } from 'express'
import { getCountries } from '../controllers/countries.controller.js'

const router = Router()
router.get('/', getCountries)
export default router
