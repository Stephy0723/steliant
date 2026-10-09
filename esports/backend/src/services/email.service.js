import nodemailer from 'nodemailer'
import { config } from '../config/index.js'

let transporter = null

function getTransporter() {
  if (transporter) return transporter
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  })
  return transporter
}

export const isEmailConfigured = () => Boolean(config.smtp.user && config.smtp.pass)

async function send({ to, subject, text, html }) {
  if (!config.smtp.user || !config.smtp.pass) {
    console.warn('[email] SMTP not configured — skipping send')
    return
  }
  await getTransporter().sendMail({ from: `"GlitchGang" <${config.smtp.from}>`, to, subject, text, html })
}

/* ── Plantilla de correo "Señal" ──────────────────────────────────────────
   Basada en el diseño de Stephanie (Correo · Restablecer contraseña):
   estilos en línea + bgcolor, fuentes seguras (sin web fonts), botón VML
   para Outlook, barra de canales rojo/verde/cian arriba de la tarjeta.

   Tema: el oscuro va inline (Gmail ignora prefers-color-scheme y siempre lo
   ve así). Apple Mail, iOS Mail, Outlook Mac/iOS y Thunderbird cambian a
   claro con las clases l-* del <style>. */
const C = {
  bg: '#06070b',
  card: '#0e1118',
  border: '#232834',
  divider: '#1d222c',
  foot: '#0a0c12',
  box: '#080a0f',
  text: '#f3f5f8',
  body: '#aab1bf',
  dim: '#8b93a3',
  label: '#6b7383',
  mute: '#5d6574',
  accent: '#00E676',
  onAccent: '#06070b',
  badgeBg: '#0b2418',
  badgeBorder: '#145c36',
  red: '#ff2e63',
  cyan: '#00f0ff',
}
const L = { // tema claro
  bg: '#eef1f5',
  card: '#ffffff',
  border: '#dfe3ea',
  foot: '#f5f7fa',
  text: '#0b0e14',
  body: '#3d4555',
  dim: '#5a6272',
  mute: '#7a8294',
  accent: '#00874a', // verde legible sobre blanco
  badgeBg: '#e6f7ee',
  badgeBorder: '#9fdcbc',
}
const MONO = "'Courier New',Courier,monospace"
const DISPLAY = 'Verdana,Geneva,Tahoma,sans-serif'
const SANS = 'Helvetica,Arial,sans-serif'
const RGB_SPLIT = '-1px 0 rgba(255,46,99,.7),1px 0 rgba(0,240,255,.7)'
const LH = 'mso-line-height-rule:exactly;'

function baseTemplate(content, { preheader = '', channel = 'CUENTA', title = 'GlitchGang', align = 'center' } = {}) {
  return `<!doctype html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${esc(title)} · GlitchGang</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
body{margin:0!important;padding:0!important;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table{border-collapse:collapse!important}img{border:0;outline:none;text-decoration:none}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
.gg-btn a:hover{background:#00c965!important}
@media screen and (max-width:620px){
.gg-wrap{width:100%!important}.gg-pad{padding-left:24px!important;padding-right:24px!important}
.gg-h1{font-size:24px!important;line-height:30px!important}.gg-btn,.gg-btn a{width:100%!important}
}
@media (prefers-color-scheme:light){
.l-bg{background:${L.bg}!important}
.l-card{background:${L.card}!important;border-color:${L.border}!important}
.l-foot{background:${L.foot}!important;border-color:${L.border}!important}
.l-box{background:${L.foot}!important;border-top-color:${L.border}!important;border-right-color:${L.border}!important;border-bottom-color:${L.border}!important}
.l-line{border-color:${L.border}!important}
.l-t{color:${L.text}!important}
.l-b{color:${L.body}!important}
.l-d{color:${L.dim}!important}
.l-m{color:${L.mute}!important}
.l-acc{color:${L.accent}!important}
.l-badge{background:${L.badgeBg}!important;border-color:${L.badgeBorder}!important;color:${L.accent}!important}
.l-pre{color:${L.bg}!important}
}
</style>
</head>
<body class="l-bg" style="margin:0;padding:0;background-color:${C.bg};">
<div class="l-pre" style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.bg};opacity:0;">${esc(preheader)}${'&#8199;&#847;'.repeat(8)}</div>
<table role="presentation" class="l-bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background-color:${C.bg};">
<tr><td align="center" style="padding:40px 12px;">
<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="gg-wrap" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;">
<tr><td style="padding:0 0 10px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="l-m" align="left" style="font-family:${MONO};font-size:11px;line-height:14px;letter-spacing:2px;color:${C.mute};${LH}">// SEÑAL · ${channel}</td>
<td class="l-m" align="right" style="font-family:${MONO};font-size:11px;line-height:14px;letter-spacing:2px;color:${C.mute};${LH}">REF&nbsp;<span style="color:${C.accent};">&#9679;</span>&nbsp;ONLINE</td>
</tr></table></td></tr>
<tr><td class="l-card" bgcolor="${C.card}" style="background-color:${C.card};border:1px solid ${C.border};border-radius:10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td height="3" style="font-size:0;line-height:0;height:3px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="18%" height="3" bgcolor="${C.red}" style="font-size:0;line-height:0;background-color:${C.red};border-top-left-radius:10px;">&nbsp;</td>
<td width="64%" height="3" bgcolor="${C.accent}" style="font-size:0;line-height:0;background-color:${C.accent};">&nbsp;</td>
<td width="18%" height="3" bgcolor="${C.cyan}" style="font-size:0;line-height:0;background-color:${C.cyan};border-top-right-radius:10px;">&nbsp;</td>
</tr></table></td></tr>
<tr><td class="gg-pad l-line" align="center" style="padding:32px 48px 26px 48px;border-bottom:1px solid ${C.divider};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
<td width="44" height="44" align="center" valign="middle" bgcolor="${C.accent}" style="width:44px;height:44px;background-color:${C.accent};border-radius:10px;font-family:${MONO};font-size:17px;font-weight:bold;line-height:44px;color:${C.onAccent};${LH}text-shadow:-1px 0 rgba(255,46,99,.55),1px 0 rgba(0,240,255,.55);">GG</td>
</tr></table>
<div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
<div class="l-t" style="font-family:${DISPLAY};font-size:13px;line-height:16px;font-weight:bold;letter-spacing:5px;color:${C.text};${LH}text-shadow:${RGB_SPLIT};">GLITCHGANG</div>
</td></tr>
<tr><td class="gg-pad" align="${align}" style="padding:36px 48px 32px 48px;text-align:${align};">
${content}
</td></tr>
<tr><td class="gg-pad l-foot" align="center" bgcolor="${C.foot}" style="background-color:${C.foot};padding:22px 48px;border-top:1px solid ${C.divider};border-bottom-left-radius:10px;border-bottom-right-radius:10px;">
<p class="l-d" style="margin:0 0 6px 0;font-family:${SANS};font-size:12px;line-height:18px;color:${C.dim};">¿No fuiste vos? Escribinos a <a class="l-acc" href="mailto:soporte@glitchgang.gg" style="color:${C.accent};text-decoration:underline;">soporte@glitchgang.gg</a></p>
<p class="l-m" style="margin:0;font-family:${MONO};font-size:11px;line-height:16px;letter-spacing:1px;color:${C.mute};">© 2026 GlitchGang · Correo automático, no responder.</p>
</td></tr>
</table></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`
}

// Píldora verde de estado: "⏳ EXPIRA EN 30 MINUTOS", "NOTIFICACIÓN"…
function badge(text, { center = true } = {}) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"${center ? ' align="center"' : ''}><tr>
<td class="l-badge" bgcolor="${C.badgeBg}" style="background-color:${C.badgeBg};border:1px solid ${C.badgeBorder};border-radius:4px;padding:6px 12px;font-family:${MONO};font-size:11px;line-height:14px;letter-spacing:1.5px;color:${C.accent};${LH}">${text}</td>
</tr></table>`
}
const expiryBadge = text => badge(`&#9203;&nbsp;${text.toUpperCase()}`)

function heading(text) {
  return `<h1 class="gg-h1 l-t" style="margin:22px 0 12px 0;font-family:${DISPLAY};font-size:26px;line-height:32px;font-weight:bold;color:${C.text};${LH}">${text}</h1>`
}

function paragraph(html, { mb = 28 } = {}) {
  return `<p class="l-b" style="margin:0 0 ${mb}px 0;font-family:${SANS};font-size:15px;line-height:24px;color:${C.body};${LH}">${html}</p>`
}

// Texto escrito por usuarios (nick) va escapado: sin esto un nick con HTML
// metia enlaces o etiquetas en el correo (riesgo de phishing y señal de spam).
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
}

function strong(text, { accent = false } = {}) {
  return `<strong class="${accent ? 'l-acc' : 'l-t'}" style="color:${accent ? C.accent : C.text};">${text}</strong>`
}

const secondary = text => `<span class="l-d" style="color:${C.dim};">${text}</span>`

function note(text) {
  return `<p class="l-d" style="margin:24px 0 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${C.dim};text-align:center;${LH}">${text}</p>`
}

// Botón con respaldo VML para Outlook de escritorio. Ancho completo en móvil.
function primaryButton(url, label, { center = true } = {}) {
  const w = Math.max(220, Math.round(label.length * 9.5 + 90))
  return `<table role="presentation" class="gg-btn" cellpadding="0" cellspacing="0" border="0"${center ? ' align="center"' : ''}><tr>
<td align="center" bgcolor="${C.accent}" style="background-color:${C.accent};border-radius:6px;">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${url}" style="height:50px;v-text-anchor:middle;width:${w}px;" arcsize="12%" stroke="f" fillcolor="${C.accent}"><w:anchorlock/><center style="color:${C.onAccent};font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${label}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${url}" target="_blank" style="display:block;padding:16px 36px;font-family:${SANS};font-size:15px;line-height:18px;font-weight:bold;color:${C.onAccent};text-decoration:none;border-radius:6px;${LH}">${label}&nbsp;&nbsp;&rarr;</a><!--<![endif]-->
</td></tr></table>`
}

function linkFallback(url) {
  return `<div style="height:30px;line-height:30px;font-size:0;">&nbsp;</div>
<p class="l-m" style="margin:0 0 8px 0;font-family:${MONO};font-size:11px;line-height:14px;letter-spacing:1.5px;color:${C.label};text-align:left;">SI EL BOTÓN NO FUNCIONA, COPIÁ Y PEGÁ ESTE ENLACE:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="l-box" bgcolor="${C.box}" style="background-color:${C.box};border:1px solid ${C.border};border-left:2px solid ${C.accent};border-radius:4px;padding:12px 14px;font-family:${MONO};font-size:12px;line-height:18px;word-break:break-all;text-align:left;${LH}"><span class="l-m" style="color:${C.mute};">&gt;&nbsp;</span><a class="l-acc" href="${url}" target="_blank" style="color:${C.accent};text-decoration:none;word-break:break-all;">${url}</a></td>
</tr></table>`
}

// Filas clave/valor (correos al staff).
function dataRows(rows) {
  const trs = rows
    .map(([k, v]) => `<tr>
<td class="l-m l-line" width="1%" style="width:1%;padding:11px 18px 9px 0;border-bottom:1px solid ${C.divider};font-family:${MONO};font-size:11px;line-height:14px;letter-spacing:1.5px;color:${C.label};white-space:nowrap;vertical-align:top;">${k.toUpperCase()}</td>
<td class="l-t l-line" style="padding:9px 0;border-bottom:1px solid ${C.divider};font-family:${SANS};font-size:14px;line-height:21px;color:${C.text};">${v}</td>
</tr>`)
    .join('')
  return `<table role="presentation" class="l-line" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 22px 0;border-top:1px solid ${C.divider};">${trs}</table>`
}

// Caja de texto largo (mensaje de soporte). Borde rojo = entrada del usuario.
function messageBox(text) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="l-box l-t" bgcolor="${C.box}" style="background-color:${C.box};border:1px solid ${C.border};border-left:2px solid ${C.red};border-radius:4px;padding:16px 18px;font-family:${SANS};font-size:14px;line-height:22px;color:${C.text};white-space:pre-wrap;">${text}</td>
</tr></table>`
}

// Personalizado (nick + correo de la cuenta): un "restablece tu contraseña"
// generico es el patron tipico del phishing y Gmail lo mandaba a spam aunque
// SPF/DKIM pasaran; el de verificacion, con el mismo dominio, si llegaba.
export async function sendPasswordResetEmail({ to, nick, resetUrl }) {
  const name = nick || 'jugador'
  await send({
    to,
    subject: `${name}, aquí tienes el enlace para cambiar tu contraseña de GlitchGang`,
    text: `Hola ${name},\n\nPediste cambiar la contraseña de tu cuenta de GlitchGang (${to}). Usa este enlace para elegir una nueva (válido 30 minutos):\n${resetUrl}\n\nSi no lo pediste tú, ignora este correo: tu contraseña no cambia.\n\n— Equipo GlitchGang`,
    html: baseTemplate(`
${expiryBadge('Expira en 30 minutos')}
${heading('Cambia tu contraseña')}
${paragraph(`Hola ${strong(esc(name))}, pediste cambiar la contraseña de tu cuenta de GlitchGang (${esc(to)}). Usa el botón para elegir una nueva.`)}
${primaryButton(resetUrl, 'Elegir contraseña nueva')}
${linkFallback(resetUrl)}
${note('Si no lo pediste tú, ignora este correo: tu contraseña no cambia.')}
`, { preheader: `Hola ${name}, el enlace para elegir tu contraseña nueva expira en 30 minutos.`, title: 'Cambia tu contraseña', channel: 'CUENTA' }),
  })
}
export async function sendVerificationEmail({ to, verifyUrl }) {
  await send({
    to,
    subject: 'Verifica tu correo · GlitchGang',
    text: `Verifica tu cuenta usando este enlace (válido 24 h):\n${verifyUrl}`,
    html: baseTemplate(`
${expiryBadge('Expira en 24 horas')}
${heading('Verificá tu correo')}
${paragraph('Confirmá tu dirección de correo para terminar de activar tu cuenta de GlitchGang.')}
${primaryButton(verifyUrl, 'Verificar correo')}
${linkFallback(verifyUrl)}
`, { preheader: 'Confirmá tu correo para activar tu cuenta. Expira en 24 horas.', title: 'Verificá tu correo', channel: 'CUENTA' }),
  })
}

export async function sendSupportRequestEmail({ fromUser, subject, message }) {
  await send({
    to: config.supportEmail,
    subject: `[Soporte] ${subject}`,
    text: `De: ${fromUser.nick} (${fromUser.email})\n\n${message}`,
    html: baseTemplate(`
${badge('TICKET DE SOPORTE', { center: false })}
${heading('Nuevo mensaje de soporte')}
${dataRows([
  ['De', `${strong(fromUser.nick)} ${secondary(`(${fromUser.email})`)}`],
  ['Asunto', strong(subject)],
])}
${messageBox(message)}
`, { preheader: `${fromUser.nick}: ${subject}`, title: 'Soporte', channel: 'SOPORTE', align: 'left' }),
  })
}

export async function sendRoleApplicationEmail({ user, roleLabel }) {
  await send({
    to: config.supportEmail,
    subject: `[Solicitud de rol] ${roleLabel} — ${user.nick}`,
    text: `${user.nick} (${user.email}) solicitó el rol de ${roleLabel}.\n\nRevísalo en el panel de administración: ${config.clientOrigin}/admin/roles`,
    html: baseTemplate(`
${badge('SOLICITUD DE ROL', { center: false })}
${heading('Nueva solicitud de rol')}
${dataRows([
  ['Usuario', `${strong(user.nick)} ${secondary(`(${user.email})`)}`],
  ['Rol', strong(roleLabel, { accent: true })],
])}
${primaryButton(`${config.clientOrigin}/admin/roles`, 'Revisar en el panel', { center: false })}
`, { preheader: `${user.nick} solicitó el rol de ${roleLabel}`, title: 'Solicitud de rol', channel: 'ADMIN', align: 'left' }),
  })
}

export async function sendRoleChangeEmail({ to, nick, roleLabel, promoted }) {
  const title = promoted ? `¡Ahora eres ${roleLabel}!` : 'Tu rol ha cambiado'
  const body = promoted
    ? `Un administrador te otorgó el rol de ${strong(roleLabel, { accent: true })} en GlitchGang. Ya tienes acceso al panel correspondiente.`
    : `Tu rol en GlitchGang cambió a ${strong(roleLabel)}.`
  await send({
    to,
    subject: `${title} · GlitchGang`,
    text: `Hola ${nick}, tu rol en GlitchGang ahora es ${roleLabel}.`,
    html: baseTemplate(`
${badge(promoted ? 'ACCESO DESBLOQUEADO' : 'ACTUALIZACIÓN DE CUENTA')}
${heading(title)}
${paragraph(`Hola ${strong(esc(nick))}, ${body}`)}
${primaryButton(config.clientOrigin, 'Ir a GlitchGang')}
`, { preheader: `Tu rol ahora es ${roleLabel}`, title, channel: 'CUENTA' }),
  })
}

// Email genérico para eventos importantes de torneo/equipo (bracket publicado,
// check-in abierto, invitación de equipo, disputa) -- espejo por correo de lo
// que ya se manda como Notification in-app, para que no dependa de tener la
// pestaña abierta. title/message vienen del mismo payload que la notificación.
export async function sendEventEmail({ to, nick, title, message, link }) {
  const url = link ? (link.startsWith('http') ? link : `${config.clientOrigin}${link}`) : null
  await send({
    to,
    subject: `${title} · GlitchGang`,
    text: `Hola ${nick}, ${message}${url ? `\n\n${url}` : ''}`,
    html: baseTemplate(`
${badge('NOTIFICACIÓN')}
${heading(esc(title))}
${paragraph(`Hola ${strong(esc(nick))}, ${esc(message)}`, { mb: url ? 28 : 0 })}
${url ? primaryButton(url, 'Ver en GlitchGang') : ''}
`, { preheader: message, title, channel: 'TORNEOS' }),
  })
}

export async function sendWelcomeEmail({ to, nick }) {
  await send({
    to,
    subject: `¡Bienvenido a GlitchGang, ${nick}!`,
    text: `Hola ${nick}, tu cuenta ha sido creada con éxito. ¡Bienvenido a GlitchGang!`,
    html: baseTemplate(`
${badge('JUGADOR CONECTADO')}
${heading(`¡Bienvenido, ${esc(nick)}!`)}
${paragraph(`Tu cuenta en ${strong('GlitchGang', { accent: true })} ha sido creada con éxito. Ya puedes participar en torneos, unirte a equipos y competir en la plataforma.`)}
${primaryButton(config.clientOrigin, 'Entrar a la arena')}
`, { preheader: 'Tu cuenta está lista. Nos vemos en la arena.', title: 'Bienvenido', channel: 'BIENVENIDA' }),
  })
}
