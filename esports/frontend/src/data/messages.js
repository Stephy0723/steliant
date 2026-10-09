export const CHAT_SPACES = [
  { id:'gg', name:'GlitchGang', short:'GG', color:'#ffe600', unread:3 },
  { id:'ranked', name:'Competitive Hub', short:'CH', color:'#ff2438', unread:1 },
  { id:'squad', name:'Nyx Squad', short:'NS', color:'#c026ff' },
  { id:'uni', name:'Liga Universitaria', short:'LU', color:'#52a8ff' },
  { id:'support', name:'Soporte Steliant', short:'ST', color:'#39ffb2' },
]

export const CHAT_CHANNELS = {
  gg:[
    { category:'Comunidad', items:[
      { id:'gg-general', name:'general', type:'text', topic:'Conversacion general de la comunidad GlitchGang', unread:3 },
      { id:'gg-news', name:'anuncios', type:'text', topic:'Noticias y comunicados oficiales', locked:true },
      { id:'gg-lfg', name:'buscar-equipo', type:'text', topic:'Encuentra jugadores y equipos para competir' },
    ]},
    { category:'Competitivo', items:[
      { id:'gg-tournaments', name:'torneos', type:'text', topic:'Inscripciones, brackets y resultados' },
      { id:'gg-results', name:'resultados', type:'text', topic:'Resultados oficiales de la plataforma' },
    ]},
    { category:'Voz', items:[
      { id:'gg-lobby', name:'Lobby general', type:'voice', members:4 },
      { id:'gg-scrims', name:'Scrims', type:'voice', members:2 },
    ]},
  ],
  ranked:[
    { category:'Ranked', items:[
      { id:'ranked-general', name:'ranked-general', type:'text', topic:'Comunidad competitiva y busqueda de partidas', unread:1 },
      { id:'ranked-vod', name:'vod-review', type:'text', topic:'Analisis de partidas y mejora competitiva' },
    ]},
  ],
  squad:[
    { category:'Equipo', items:[
      { id:'squad-general', name:'chat-del-equipo', type:'text', topic:'Coordinacion privada de Nyx Squad' },
      { id:'squad-calendar', name:'calendario', type:'text', topic:'Entrenamientos y torneos del equipo' },
    ]},
    { category:'Voz', items:[{ id:'squad-voice', name:'Sala tactica', type:'voice', members:3 }]},
  ],
  uni:[
    { category:'Liga universitaria', items:[
      { id:'uni-general', name:'general', type:'text', topic:'Comunidad universitaria GlitchGang' },
      { id:'uni-events', name:'eventos', type:'text', topic:'Clasificatorias y actividades universitarias' },
    ]},
  ],
  support:[
    { category:'Ayuda', items:[
      { id:'support-ticket', name:'mi-ticket', type:'text', topic:'Canal privado con soporte Steliant' },
    ]},
  ],
}

export const CHAT_MEMBERS = {
  gg:[
    { id:1, nick:'Brooklyn', role:'Admin', status:'online', avatar:'https://i.pravatar.cc/48?img=12' },
    { id:2, nick:'Vexon', role:'Caster', status:'online', avatar:'https://i.pravatar.cc/48?img=5' },
    { id:3, nick:'Miraya', role:'Creator', status:'online', avatar:'https://i.pravatar.cc/48?img=29' },
    { id:4, nick:'Krypto99', role:'Jugador', status:'away', avatar:'https://i.pravatar.cc/48?img=17' },
    { id:5, nick:'ZeroGravity', role:'Coach', status:'offline', avatar:'https://i.pravatar.cc/48?img=60' },
    { id:6, nick:'NovaPulse', role:'Jugador', status:'offline', avatar:'https://i.pravatar.cc/48?img=33' },
  ],
  ranked:[
    { id:2, nick:'Vexon', role:'Caster', status:'online', avatar:'https://i.pravatar.cc/48?img=5' },
    { id:4, nick:'Krypto99', role:'Jugador', status:'away', avatar:'https://i.pravatar.cc/48?img=17' },
    { id:5, nick:'ZeroGravity', role:'Coach', status:'online', avatar:'https://i.pravatar.cc/48?img=60' },
  ],
  squad:[
    { id:1, nick:'Brooklyn', role:'Capitan', status:'online', avatar:'https://i.pravatar.cc/48?img=12' },
    { id:3, nick:'Miraya', role:'Jugador', status:'online', avatar:'https://i.pravatar.cc/48?img=29' },
    { id:4, nick:'Krypto99', role:'Jugador', status:'away', avatar:'https://i.pravatar.cc/48?img=17' },
  ],
  uni:[
    { id:1, nick:'Brooklyn', role:'Jugador', status:'online', avatar:'https://i.pravatar.cc/48?img=12' },
    { id:6, nick:'NovaPulse', role:'Organizador', status:'online', avatar:'https://i.pravatar.cc/48?img=33' },
  ],
  support:[
    { id:7, nick:'Steliant Support', role:'Soporte', status:'online', avatar:'https://i.pravatar.cc/48?img=48' },
    { id:1, nick:'Brooklyn', role:'Usuario', status:'online', avatar:'https://i.pravatar.cc/48?img=12' },
  ],
}

export const INITIAL_CHANNEL_MESSAGES = {
  'dm-vexon':[
    { id:1, author:'Vexon', avatar:'https://i.pravatar.cc/48?img=5', time:'Hoy, 12:20', text:'Buen cierre en la ultima partida. Te escribo para coordinar la siguiente clasificatoria.' },
  ],
  'dm-miraya':[
    { id:1, author:'Miraya', avatar:'https://i.pravatar.cc/48?img=29', time:'Hoy, 11:20', text:'Manana entrenamos a las 8pm? Puedo preparar los clips antes del scrim.' },
  ],
  'dm-krypto':[
    { id:1, author:'Krypto99', avatar:'https://i.pravatar.cc/48?img=17', time:'Ayer, 21:02', text:'Subes al Premier esta noche? Falta uno para completar el equipo.' },
  ],
  'gg-general':[
    { id:1, author:'Vexon', avatar:'https://i.pravatar.cc/48?img=5', time:'Hoy, 12:28', text:'Ese cierre de la clasificatoria estuvo intenso. El bracket ya quedo actualizado.' },
    { id:2, author:'Miraya', avatar:'https://i.pravatar.cc/48?img=29', time:'Hoy, 12:31', text:'Subi los clips de la final al canal de contenido. Buen trabajo con la cobertura.' },
    { id:3, author:'Brooklyn', avatar:'https://i.pravatar.cc/48?img=12', time:'Hoy, 12:34', text:'Excelente. Recuerden confirmar disponibilidad para el siguiente torneo.', mine:true },
  ],
  'gg-news':[
    { id:1, author:'GlitchGang Staff', avatar:'https://i.pravatar.cc/48?img=48', time:'Hoy, 09:00', text:'Las inscripciones para GG Invitational estan abiertas. Revisa la seccion de torneos para registrar tu equipo.', system:true },
  ],
  'gg-lfg':[
    { id:1, author:'Krypto99', avatar:'https://i.pravatar.cc/48?img=17', time:'Ayer, 20:12', text:'Busco equipo para competir en Valorant. Main controller, disponible de noche.' },
  ],
  'gg-tournaments':[
    { id:1, author:'NovaPulse', avatar:'https://i.pravatar.cc/48?img=33', time:'Hoy, 10:15', text:'El check-in de GG Invitational inicia 30 minutos antes del primer match.' },
  ],
  'ranked-general':[
    { id:1, author:'ZeroGravity', avatar:'https://i.pravatar.cc/48?img=60', time:'Hoy, 11:02', text:'Esta noche hare revision de VOD para jugadores que quieran mejorar rotaciones.' },
  ],
  'squad-general':[
    { id:1, author:'Miraya', avatar:'https://i.pravatar.cc/48?img=29', time:'Hoy, 08:44', text:'Entrenamiento confirmado para las 8pm. Revisamos estrategia antes del scrim.' },
  ],
  'squad-calendar':[
    { id:1, author:'Brooklyn', avatar:'https://i.pravatar.cc/48?img=12', time:'Ayer, 18:00', text:'Sabado: clasificatoria a las 6pm. Lleguen 45 minutos antes.', mine:true },
  ],
  'uni-general':[
    { id:1, author:'NovaPulse', avatar:'https://i.pravatar.cc/48?img=33', time:'Hoy, 10:30', text:'Bienvenidos a la liga universitaria. Pronto publicaremos el calendario regional.' },
  ],
  'support-ticket':[
    { id:1, author:'Steliant Support', avatar:'https://i.pravatar.cc/48?img=48', time:'Hoy, 09:20', text:'Hola Brooklyn. Este es tu canal privado de soporte. Describe tu consulta y te ayudaremos.' },
  ],
}

export const DIRECT_MESSAGES = [
  { id:'dm-vexon', nick:'Vexon', avatar:'https://i.pravatar.cc/48?img=5', online:true, unread:2 },
  { id:'dm-miraya', nick:'Miraya', avatar:'https://i.pravatar.cc/48?img=29', online:true },
  { id:'dm-krypto', nick:'Krypto99', avatar:'https://i.pravatar.cc/48?img=17', online:false },
]

