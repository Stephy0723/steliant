import { Router } from 'express'
import {
  createTeam, listTeams, getMyTeam, getMyTeams, getMyFormerTeams, getMyStaffTeams, getTeamById,
  updateMyTeam, updateMyRosterSlot, updateTeamLogo, deleteTeam,
  getTeamByInviteCode, joinTeam,
  requestToJoin, respondJoinRequest, updateRecruitment, getMyJoinRequests,
  leaveTeam, transferTeamLeadership, getRanking, getUniversitySlot,
  inviteToTeam, listTeamInvitations, cancelTeamInvitation, getMyInvitations, respondTeamInvitation,
  listInvitableFriends, getInviteOptionsForUser, removeTeamMember, changeTeamMemberRole, getInviteSuggestions, getUserTeams,
} from '../controllers/team.controller.js'
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js'
import { teamLogoUpload } from '../middleware/multer.js'
import { generalLimiter, uploadLimiter } from '../middleware/rateLimit.js'

const router = Router()

// Public team queries
router.get('/', generalLimiter, optionalAuth, listTeams)
router.get('/ranking', optionalAuth, getRanking)
router.get('/my', requireAuth, getMyTeam)
router.get('/mine', requireAuth, getMyTeams)
router.get('/mine/history', requireAuth, getMyFormerTeams)
router.get('/staff/mine', requireAuth, getMyStaffTeams)
router.get('/of/:userId', optionalAuth, getUserTeams)
router.get('/requests/mine', requireAuth, getMyJoinRequests)
router.get('/university-slot', requireAuth, getUniversitySlot)
router.get('/invitations/mine', requireAuth, getMyInvitations)
router.post('/invitations/:invId/respond', requireAuth, respondTeamInvitation)
router.get('/invite-options/:userId', requireAuth, getInviteOptionsForUser)
router.get('/invite/:code', requireAuth, getTeamByInviteCode)
router.get('/:teamId', optionalAuth, getTeamById)

// Create / manage
router.post('/', requireAuth, teamLogoUpload, createTeam)
router.patch('/my', requireAuth, updateMyTeam)
router.put('/my', requireAuth, updateMyTeam)
router.patch('/my/logo', requireAuth, uploadLimiter, teamLogoUpload, updateTeamLogo)
router.patch('/:teamId/manage', requireAuth, updateMyTeam)
router.put('/:teamId/manage', requireAuth, updateMyTeam)
router.patch('/:teamId/roster/mine', requireAuth, updateMyRosterSlot)
router.patch('/:teamId/logo', requireAuth, uploadLimiter, teamLogoUpload, updateTeamLogo)
router.delete('/:teamId', requireAuth, deleteTeam)

// Membership
router.post('/join', requireAuth, joinTeam)
router.post('/leave', requireAuth, leaveTeam)
router.patch('/:teamId/leader', requireAuth, transferTeamLeadership)
router.delete('/:teamId/members/:userId', requireAuth, removeTeamMember)
router.patch('/:teamId/members/:userId/role', requireAuth, changeTeamMemberRole)
router.put('/:teamId/recruitment', requireAuth, updateRecruitment)
router.post('/:teamId/requests', requireAuth, requestToJoin)
router.patch('/:teamId/requests/:reqId', requireAuth, respondJoinRequest)
router.get('/:teamId/invitations', requireAuth, listTeamInvitations)
router.get('/:teamId/invitable-friends', requireAuth, listInvitableFriends)
router.get('/:teamId/invite-suggestions', requireAuth, generalLimiter, getInviteSuggestions)
router.post('/:teamId/invitations', requireAuth, generalLimiter, inviteToTeam)
router.delete('/:teamId/invitations/:invId', requireAuth, cancelTeamInvitation)

export default router
