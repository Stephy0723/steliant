import multer from 'multer'
import path from 'node:path'
import crypto from 'node:crypto'
import fs from 'node:fs'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function imageStorage(dest) {
  return multer.diskStorage({
    destination(_req, _file, cb) {
      ensureDir(dest)
      cb(null, dest)
    },
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`)
    },
  })
}

function imageFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase()
  if (!ALLOWED_IMAGE_TYPES.has(file.mimetype) || !ALLOWED_IMAGE_EXTS.has(ext)) {
    return cb(Object.assign(new Error('Only JPEG, PNG or WEBP images are allowed'), { status: 400 }))
  }
  cb(null, true)
}

export const avatarUpload = multer({
  storage: imageStorage('uploads/avatars'),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('avatar')

export const profileBackgroundUpload = multer({
  storage: imageStorage('uploads/profile-backgrounds'),
  fileFilter: imageFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
}).single('background')

export const teamLogoUpload = multer({
  storage: imageStorage('uploads/teams'),
  fileFilter: imageFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
}).single('logo')

export const tournamentBannerUpload = multer({
  storage: imageStorage('uploads/tournaments'),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('banner')
