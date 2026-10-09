// Professional email templates for GlitchGang + Stelliant
// Dynamic templates with personalization

export const emailTemplates = {
  welcome: (name) => ({
    type: 'welcome',
    subject: `¡Bienvenido a STELIANT ESPORTS, ${name}!`,
    preview: 'Tu viaje competitivo comienza ahora',
    emailHtml: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f1419; color: #fff; }
          .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1f2e 0%, #16181f 100%); border: 1px solid rgba(76,213,173,.2); border-radius: 16px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #00C97A 0%, #2463EB 100%); padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 32px; color: #fff; font-weight: 900; }
          .content { padding: 40px 30px; }
          .welcome-text { font-size: 16px; line-height: 1.6; color: #e0e0e0; margin-bottom: 30px; }
          .highlight { color: #00C97A; font-weight: 700; }
          .features { display: grid; gap: 20px; margin: 30px 0; }
          .feature { border: 1px solid rgba(76,213,173,.1); border-radius: 10px; padding: 20px; background: rgba(76,213,173,.02); }
          .feature-title { color: #00C97A; font-weight: 700; margin-bottom: 8px; }
          .feature-desc { font-size: 14px; color: #b0b0b0; }
          .cta-section { text-align: center; margin: 40px 0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #00C97A 0%, #00FF9D 100%); color: #000; padding: 14px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; box-shadow: 0 8px 24px rgba(0,201,122,.3); }
          .footer { border-top: 1px solid rgba(255,255,255,.1); padding: 30px; text-align: center; font-size: 12px; color: #808080; }
          .signature { margin-top: 20px; font-size: 13px; }
          .brand { color: #00C97A; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎮 STELIANT ESPORTS</h1>
          </div>
          <div class="content">
            <p class="welcome-text">
              ¡Hola <span class="highlight">${name}</span>!
            </p>
            <p class="welcome-text">
              Bienvenido a <span class="brand">STELIANT ESPORTS</span>, el ecosistema competitivo más innovador de esports en Latinoamérica. Junto a <span class="brand">Stelliant</span>, estamos redefiniendo cómo los jugadores conectan, compiten y crecen.
            </p>

            <div class="features">
              <div class="feature">
                <div class="feature-title">⚔️ Competencias Profesionales</div>
                <div class="feature-desc">Acceso a torneos, scrims y ligas con jugadores de tu nivel.</div>
              </div>
              <div class="feature">
                <div class="feature-title">🤝 Comunidad Global</div>
                <div class="feature-desc">Conecta con miles de jugadores, forma equipos y crea alianzas.</div>
              </div>
              <div class="feature">
                <div class="feature-title">📊 Estadísticas Avanzadas</div>
                <div class="feature-desc">Monitorea tu progreso con análisis detallados de rendimiento.</div>
              </div>
              <div class="feature">
                <div class="feature-title">🏆 Oportunidades de Crecimiento</div>
                <div class="feature-desc">Gana reconocimiento, becas y oportunidades profesionales.</div>
              </div>
            </div>

            <div class="cta-section">
              <a href="https://glitchgang.gg/perfil/completar" class="cta-button">Completar Mi Perfil</a>
            </div>

            <p class="welcome-text" style="margin-top: 30px; font-size: 14px; color: #b0b0b0;">
              Si tienes preguntas, nuestro equipo de soporte está disponible 24/7 en support@glitchgang.gg
            </p>
          </div>
          <div class="footer">
            <p>© 2026 STELIANT ESPORTS × STELLIANT. Todos los derechos reservados.</p>
            <p class="signature">
              Made with 💚 for competitive gaming
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  birthday: (name, year) => ({
    type: 'birthday',
    subject: `¡Feliz Cumpleaños, ${name}! 🎂`,
    preview: 'Celebra con la comunidad GlitchGang',
    emailHtml: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f1419; color: #fff; }
          .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1f2e 0%, #16181f 100%); border: 1px solid rgba(233,30,140,.2); border-radius: 16px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #E91E8C 0%, #FF6BB0 100%); padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; color: #fff; font-weight: 900; }
          .confetti { font-size: 32px; }
          .content { padding: 40px 30px; }
          .birthday-text { font-size: 16px; line-height: 1.6; color: #e0e0e0; margin-bottom: 25px; }
          .highlight { color: #E91E8C; font-weight: 700; }
          .gift-box { border: 2px solid #E91E8C; border-radius: 12px; padding: 25px; background: rgba(233,30,140,.08); text-align: center; margin: 30px 0; }
          .gift-emoji { font-size: 48px; margin-bottom: 15px; }
          .gift-title { color: #E91E8C; font-weight: 700; font-size: 18px; margin-bottom: 10px; }
          .gift-desc { color: #b0b0b0; font-size: 14px; margin-bottom: 15px; }
          .reward-codes { background: rgba(0,0,0,.3); border-left: 4px solid #E91E8C; padding: 15px; border-radius: 8px; margin: 20px 0; font-family: 'Courier New', monospace; font-size: 13px; }
          .code { color: #00FF9D; }
          .cta-section { text-align: center; margin: 30px 0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #E91E8C 0%, #FF6BB0 100%); color: #fff; padding: 14px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; box-shadow: 0 8px 24px rgba(233,30,140,.3); }
          .community-invite { border: 1px solid rgba(233,30,140,.2); border-radius: 10px; padding: 20px; background: rgba(233,30,140,.02); margin: 20px 0; }
          .footer { border-top: 1px solid rgba(255,255,255,.1); padding: 30px; text-align: center; font-size: 12px; color: #808080; }
          .signature { margin-top: 15px; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="confetti">🎂 🎁 🎉 🎊 🎈</div>
            <h1>¡Feliz Cumpleaños, ${name}!</h1>
          </div>
          <div class="content">
            <p class="birthday-text">
              Desde toda la comunidad de <span class="highlight">STELIANT ESPORTS</span> te enviamos un gigantesco abrazo en tu día especial.
            </p>

            <div class="gift-box">
              <div class="gift-emoji">🎁</div>
              <div class="gift-title">Regalos Exclusivos de Cumpleaños</div>
              <div class="gift-desc">Hemos preparado sorpresas especiales para ti</div>
              <div class="reward-codes">
                <div>💎 Premium Pass: <span class="code">BDAY-${year}-GLITCH</span></div>
                <div>⭐ Boost x2: <span class="code">2X-BOOST-${name.toUpperCase().slice(0, 3)}</span></div>
                <div>🏆 Tournament Entry: <span class="code">TOURNEY-FREE-${year}</span></div>
              </div>
              <div style="font-size: 13px; color: #b0b0b0;">Válidos solo hoy • Úsalos en tu panel de control</div>
            </div>

            <div class="community-invite">
              <p style="margin: 0 0 15px 0; font-weight: 700; color: #E91E8C;">🎮 Celebra Con Nosotros</p>
              <p style="margin: 0; color: #b0b0b0; font-size: 14px;">
                Únete a nuestro Discord especial de cumpleaños donde la comunidad quiere felicitarte. ¡Habrá giveaways y sorpresas!
              </p>
            </div>

            <div class="cta-section">
              <a href="https://discord.gg/bZTsanNB3G" class="cta-button">Ver Mis Regalos</a>
            </div>

            <p class="birthday-text" style="margin-top: 30px; font-size: 14px; color: #b0b0b0; text-align: center;">
              Que sea un año lleno de victorias, crecimiento y momentos increíbles en los juegos que amas.
            </p>
          </div>
          <div class="footer">
            <p>© 2026 STELIANT ESPORTS × STELLIANT. Todos los derechos reservados.</p>
            <p class="signature">
              Hecho con 💚 para ti en tu día especial
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  christmas: (name) => ({
    type: 'christmas',
    subject: `¡Feliz Navidad, ${name}! 🎄`,
    preview: 'Celebremos juntos esta temporada festiva',
    emailHtml: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0a0e1a; color: #fff; }
          .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1f2e 0%, #16181f 100%); border: 1px solid rgba(204,21,41,.2); border-radius: 16px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #CC1529 0%, #FF2244 100%); padding: 40px 30px; text-align: center; position: relative; }
          .snowflake { position: absolute; color: #fff; font-size: 24px; opacity: .6; }
          .header h1 { margin: 0; font-size: 32px; color: #fff; font-weight: 900; position: relative; z-index: 1; }
          .content { padding: 40px 30px; }
          .greeting { font-size: 16px; line-height: 1.6; color: #e0e0e0; margin-bottom: 30px; }
          .highlight { color: #CC1529; font-weight: 700; }
          .christmas-card { border: 2px solid rgba(204,21,41,.4); border-radius: 12px; padding: 30px; background: linear-gradient(135deg, rgba(204,21,41,.08) 0%, rgba(0,201,122,.05) 100%); margin: 30px 0; text-align: center; }
          .card-emoji { font-size: 56px; margin-bottom: 15px; }
          .card-title { font-size: 20px; font-weight: 700; color: #00C97A; margin-bottom: 15px; }
          .card-text { color: #b0b0b0; line-height: 1.6; font-size: 14px; }
          .special-offers { display: grid; gap: 15px; margin: 30px 0; }
          .offer { border: 1px solid rgba(204,21,41,.2); border-radius: 10px; padding: 18px; background: rgba(204,21,41,.03); }
          .offer-title { color: #CC1529; font-weight: 700; font-size: 13px; margin-bottom: 6px; }
          .offer-desc { color: #b0b0b0; font-size: 13px; }
          .cta-section { text-align: center; margin: 40px 0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #CC1529 0%, #FF2244 100%); color: #fff; padding: 14px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; box-shadow: 0 8px 24px rgba(204,21,41,.3); }
          .message { background: rgba(0,201,122,.08); border-left: 4px solid #00C97A; border-radius: 8px; padding: 20px; margin: 25px 0; }
          .message-title { color: #00C97A; font-weight: 700; margin-bottom: 8px; }
          .message-text { color: #b0b0b0; line-height: 1.6; font-size: 14px; }
          .footer { border-top: 1px solid rgba(255,255,255,.1); padding: 30px; text-align: center; font-size: 12px; color: #808080; }
          .signature { margin-top: 15px; font-size: 13px; color: #CC1529; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div style="position: relative; height: 40px;">
              <div class="snowflake" style="left: 5%; top: 0;">❄️</div>
              <div class="snowflake" style="left: 15%; top: 10px;">❄️</div>
              <div class="snowflake" style="right: 10%; top: 5px;">❄️</div>
              <div class="snowflake" style="right: 25%; top: 15px;">❄️</div>
            </div>
            <h1>🎄 ¡Feliz Navidad, ${name}! 🎄</h1>
          </div>
          <div class="content">
            <div class="greeting">
              Desde toda la familia de <span class="highlight">STELIANT ESPORTS</span> y <span class="highlight">STELLIANT</span>, queremos desearte una <span class="highlight">Navidad extraordinaria</span> llena de alegría, victoria y momentos incríbles junto a tu comunidad.
            </div>

            <div class="christmas-card">
              <div class="card-emoji">🎁</div>
              <div class="card-title">Regalos Navideños</div>
              <div class="card-text">
                Hemos preparado sorpresas especiales para celebrar contigo estas festividades
              </div>
            </div>

            <div class="special-offers">
              <div class="offer">
                <div class="offer-title">🎮 50% OFF Premium Annual</div>
                <div class="offer-desc">Código: NAVIDAD2026 • Válido hasta 31 de Diciembre</div>
              </div>
              <div class="offer">
                <div class="offer-title">💎 Loot Box Premium x3</div>
                <div class="offer-desc">Reclama en tu panel de control • Skins exclusivas adentro</div>
              </div>
              <div class="offer">
                <div class="offer-title">🏆 Torneo Navideño</div>
                <div class="offer-desc">Premios de hasta $10,000 • Inscripción gratuita para Premium</div>
              </div>
            </div>

            <div class="message">
              <div class="message-title">💚 Mensaje de la Comunidad</div>
              <div class="message-text">
                En estas fechas especiales, queremos recordarte lo importante que eres para nuestra comunidad. Cada competencia que juegas, cada equipo que formas, cada victoria que celebras... son parte de nuestra historia compartida. Gracias por ser parte de STELIANT ESPORTS.
              </div>
            </div>

            <div class="cta-section">
              <a href="https://glitchgang.gg/navidad" class="cta-button">Ver Ofertas Navideñas</a>
            </div>
          </div>
          <div class="footer">
            <p>© 2026 STELIANT ESPORTS × STELLIANT. Todos los derechos reservados.</p>
            <p class="signature">
              Que brille tu luz competitiva en estas festividades 🌟
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  })
}

