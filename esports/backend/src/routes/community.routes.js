import { Router } from 'express'
import { rejectIfMuted } from '../middleware/rejectIfMuted.js'
import {
  listCommunities, createCommunity, updateCommunity, joinCommunity, leaveCommunity,
  getCommunityDetail, getMyCommunities, listCommunityMembers, removeCommunityMember,
  getCommunityStats, listCommunityBans, unbanCommunityMember, transferOwnership, deleteCommunity,
} from '../controllers/community.controller.js'
import {
  getCommunityFeed,
  createCommunityFeedPost,
  updateCommunityFeedPost,
  toggleCommunityFeedPostLike,
  addCommunityFeedPostComment,
  voteCommunityFeedPoll,
  toggleCommunityFeedInterested,
  reportCommunityFeedPost,
  deleteCommunityFeedPost,
} from '../controllers/communityPost.controller.js'
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js'
import { generalLimiter } from '../middleware/rateLimit.js'

const router = Router()

// Comunidades
// Rutas estáticas ("/mine") van antes de "/:id", si no Express intenta
// resolver "mine" como si fuera un :id.
router.get('/',          generalLimiter, optionalAuth, listCommunities)
router.post('/',         requireAuth, generalLimiter, createCommunity)
router.get('/mine',      requireAuth, generalLimiter, getMyCommunities)
router.get('/:id',       generalLimiter, optionalAuth, getCommunityDetail)
router.put('/:id',       requireAuth, generalLimiter, updateCommunity)
router.delete('/:id',    requireAuth, deleteCommunity)
router.post('/:id/join',  requireAuth, generalLimiter, joinCommunity)
router.post('/:id/leave', requireAuth, generalLimiter, leaveCommunity)
router.post('/:id/transfer', requireAuth, generalLimiter, transferOwnership)

// Gestión (solo el creador de la comunidad, o un admin de la plataforma)
router.get('/:id/members',              requireAuth, generalLimiter, listCommunityMembers)
router.delete('/:id/members/:userId',   requireAuth, removeCommunityMember)
router.get('/:id/bans',                 requireAuth, generalLimiter, listCommunityBans)
router.delete('/:id/bans/:userId',      requireAuth, unbanCommunityMember)
router.get('/:id/stats',                requireAuth, generalLimiter, getCommunityStats)

// Feed de publicaciones de una comunidad
router.get('/:id/posts',                        generalLimiter, optionalAuth, getCommunityFeed)
router.post('/:id/posts',                       requireAuth, rejectIfMuted, generalLimiter, createCommunityFeedPost)
router.put('/:id/posts/:postId',                requireAuth, generalLimiter, updateCommunityFeedPost)
router.post('/:id/posts/:postId/like',          requireAuth, generalLimiter, toggleCommunityFeedPostLike)
router.post('/:id/posts/:postId/comments',      requireAuth, rejectIfMuted, generalLimiter, addCommunityFeedPostComment)
router.post('/:id/posts/:postId/vote',          requireAuth, generalLimiter, voteCommunityFeedPoll)
router.post('/:id/posts/:postId/interested',    requireAuth, generalLimiter, toggleCommunityFeedInterested)
router.post('/:id/posts/:postId/report',        requireAuth, generalLimiter, reportCommunityFeedPost)
router.delete('/:id/posts/:postId',             requireAuth, deleteCommunityFeedPost)

export default router
