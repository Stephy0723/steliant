import { Router } from 'express'
import {
  createMyMatch,
  createMyTournamentResult,
  getDailyStats,
  getGameStats, getMapStats,
  getRatingTimeline,
  getTopCharacters,
  getWeeklyActivity,
  listPlayerMatches,
  listTournamentResults,
} from '../controllers/player.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)

router.get('/:playerId/matches', listPlayerMatches)
router.post('/me/matches', createMyMatch)
router.get('/:playerId/stats/games', getGameStats)
router.get('/:playerId/stats/maps', getMapStats)
router.get('/:playerId/activity/weekly', getWeeklyActivity)
router.get('/:playerId/stats/daily', getDailyStats)
router.get('/:playerId/rating/timeline', getRatingTimeline)
router.get('/:playerId/characters/top', getTopCharacters)
router.get('/:playerId/tournaments', listTournamentResults)
router.post('/me/tournaments', createMyTournamentResult)

export default router
