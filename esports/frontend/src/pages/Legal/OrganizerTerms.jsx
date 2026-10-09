import LegalDoc from './LegalDoc.jsx'

const UPDATED = '8 de junio de 2026'

const SECTIONS = [
  {
    id: 'rol', title: '1. Rol de organizador',
    body: [
      'El rol de Organizador permite crear y gestionar torneos. Requiere aprobación de la administración y la verificación de identidad.',
      'Eres responsable de tu torneo: reglas, premios, arbitraje y trato a los participantes.',
    ],
  },
  {
    id: 'creacion', title: '2. Creación y publicación de torneos',
    body: [
      'Debes publicar reglas claras: formato, fechas, mapas, criterios de desempate, sanciones y premios.',
      'La información debe ser veraz. No se permiten torneos engañosos, ilegales o que infrinjan derechos de terceros.',
    ],
  },
  {
    id: 'checkin', title: '3. Check-in (Discord + bot) — obligatorio',
    body: [
      'El check-in se realiza en Discord con el bot oficial de STELIANT ESPORTS; es una regla inamovible en todos los torneos.',
      'Plan PRO: puedes usar tu propio servidor de Discord con el bot invitado. Plan GRATIS: debes coordinar con la administración para habilitar el bot y el canal.',
      'Existen dos check-ins: el de presencia (confirmar participación) y el previo al torneo (~30 min antes). Debes definir y publicar las horas; cualquier cambio se notifica a los participantes.',
    ],
  },
  {
    id: 'sobrecupo', title: '4. Sobre cupo y segundo check-in',
    body: [
      'Si activas el sobre cupo, los equipos en cola pueden entrar ante ausencias y se les abre un segundo check-in con una ventana de 6 a 12 horas que tú defines.',
      'Si fijas esta regla como inamovible, queda publicada en el reglamento del torneo.',
    ],
  },
  {
    id: 'resultados', title: '5. Resultados y justificación',
    body: [
      'Debes validar cada resultado con su justificación (marcador + capturas de ambos equipos) para garantizar transparencia y evitar trampas.',
      'Puedes publicar resultados de forma directa o dejarlos pendientes de confirmación. Tus decisiones de arbitraje son finales salvo error manifiesto.',
    ],
  },
  {
    id: 'premios', title: '6. Premios',
    body: [
      'Debes contar con los fondos/objetos y la autorización para los premios que ofreces, y entregarlos en los plazos anunciados.',
      'STELIANT ESPORTS no es responsable de premios ofrecidos por el organizador; el incumplimiento puede conllevar la pérdida del rol.',
    ],
  },
  {
    id: 'conducta', title: '7. Conducta y moderación',
    body: [
      'Debes tratar a participantes y staff con respeto y aplicar las reglas de forma imparcial.',
      'Está prohibido el favoritismo, el fraude y el uso indebido de los datos de los participantes.',
    ],
  },
  {
    id: 'datos', title: '8. Datos de los participantes',
    body: [
      'Solo puedes usar los datos de los participantes para operar tu torneo. No puedes venderlos ni usarlos para fines ajenos.',
      'Las integraciones (Discord/WhatsApp) que conectes procesan datos según sus propias políticas.',
    ],
  },
  {
    id: 'comisiones', title: '9. Cuotas, comisiones y pagos',
    body: [
      'Si cobras inscripción, se aplican la Política de Pagos y, cuando corresponda, una comisión de servicio informada de antemano.',
    ],
  },
  {
    id: 'sanciones', title: '10. Sanciones',
    body: [
      'El incumplimiento de estos términos puede conllevar la suspensión del torneo, la retirada del rol de organizador o la expulsión de la plataforma.',
    ],
  },
]

export default function OrganizerTerms() {
  return (
    <LegalDoc
      title="Términos de Organizador"
      updated={UPDATED}
      intro="Reglas para crear y gestionar torneos en STELIANT ESPORTS."
      sections={SECTIONS}
    />
  )
}

