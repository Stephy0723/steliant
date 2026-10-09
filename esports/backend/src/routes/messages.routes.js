import { Router } from 'express'
import { rejectIfMuted } from '../middleware/rejectIfMuted.js'
import { requireDatabase } from '../middleware/requireDatabase.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import {
  createConversation,
  getConversation,
  listConversations,
  markConversationRead,
  sendMessage,
  shareToDestinations,
  uploadMessageAttachment,
  voteOnPoll,
} from '../controllers/messages.controller.js'

const router = Router()

router.use(requireDatabase, requireAuth)

router.get('/conversations', listConversations)
router.post('/conversations', rejectIfMuted, createConversation)
router.get('/conversations/:id', getConversation)
router.post('/conversations/:id/messages', rejectIfMuted, sendMessage)
router.patch('/conversations/:id/messages/:messageId/votes', voteOnPoll)
router.patch('/conversations/:id/read', markConversationRead)
router.post('/attachments', uploadMessageAttachment)
router.post('/share', shareToDestinations)

export default router
