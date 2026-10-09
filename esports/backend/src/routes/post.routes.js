import { Router } from 'express'
import { rejectIfMuted } from '../middleware/rejectIfMuted.js'
import { 
  listPosts, listSavedPosts, createPost, deletePost, likePost,
  savePost, reportPost, blockPost, votePoll,
  listComments, createComment, likeComment, reportComment, deleteComment
} from '../controllers/post.controller.js'
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js'
import { generalLimiter } from '../middleware/rateLimit.js'

const router = Router()

// Public / optional auth
router.get('/', generalLimiter, optionalAuth, listPosts)
router.get('/:id/comments', generalLimiter, optionalAuth, listComments)

// Authenticated routes
router.use(requireAuth)
router.get('/saved', listSavedPosts)
router.post('/', rejectIfMuted, createPost)
router.post('/:id/like', likePost)
router.post('/:id/save', savePost)
router.post('/:id/report', reportPost)
router.post('/:id/block', blockPost)
router.post('/:id/vote', votePoll)
router.delete('/:id', deletePost)

// Comment actions
router.post('/:id/comments', rejectIfMuted, createComment)
router.post('/comments/:commentId/like', likeComment)
router.post('/comments/:commentId/report', reportComment)
router.delete('/comments/:commentId', deleteComment)

export default router
