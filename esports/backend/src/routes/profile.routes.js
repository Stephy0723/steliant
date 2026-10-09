import { Router } from 'express'
import {
  getPublicProfile, getPublicProfileByIdentifier, updateProfile, updateAvatar, updateProfileBackground,
  updateProfileCardBackground, getMyReferralCode, searchStaffByRole, searchPlayers,
  sendFriendRequest, respondFriendRequest, removeFriend, cancelFriendRequest,
  blockUser, unblockUser, listBlockedUsers, reportUser,
} from '../controllers/profile.controller.js'
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js'
import { avatarUpload, profileBackgroundUpload } from '../middleware/multer.js'
import { generalLimiter, uploadLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.get('/lookup/:identifier', optionalAuth, getPublicProfileByIdentifier)
router.get('/staff', requireAuth, searchStaffByRole)
router.get('/search', optionalAuth, searchPlayers)
router.get('/me/blocked', requireAuth, listBlockedUsers)
router.post('/:userId/report', requireAuth, generalLimiter, reportUser)
router.get('/:userId', optionalAuth, getPublicProfile)

router.use(requireAuth)

router.get('/me/referral-code', getMyReferralCode)
router.patch('/me', updateProfile)
router.patch('/me/avatar', uploadLimiter, avatarUpload, updateAvatar)
router.patch('/me/background', uploadLimiter, profileBackgroundUpload, updateProfileBackground)
router.patch('/me/card-background', uploadLimiter, profileBackgroundUpload, updateProfileCardBackground)
router.post('/me/friends/request/:userId', sendFriendRequest)
router.delete('/me/friends/request/:userId', cancelFriendRequest)
router.patch('/me/friends/:userId', respondFriendRequest)
router.delete('/me/friends/:userId', removeFriend)
router.post('/me/block/:userId', blockUser)
router.delete('/me/block/:userId', unblockUser)

export default router
