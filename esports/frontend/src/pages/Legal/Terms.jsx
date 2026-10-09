import LegalDoc from './LegalDoc.jsx'

const UPDATED = '7 de junio de 2026'

const SECTIONS = [
  {
    id: 'aceptacion', title: '1. Aceptación de los términos',
    body: [
      'Al crear una cuenta, inscribirte en un torneo, organizar eventos o usar cualquier función de STELIANT ESPORTS ("la plataforma"), aceptas estos Términos y Condiciones y la Política de Privacidad aquí incluida.',
      'Si no estás de acuerdo con alguno de estos términos, no debes usar la plataforma.',
    ],
  },
  {
    id: 'elegibilidad', title: '2. Cuentas y elegibilidad',
    body: [
      'Debes tener la edad mínima exigida por tu país o por el torneo específico (cuando aplique, se indica en el reglamento del evento).',
      'Eres responsable de la veracidad de tus datos y de la seguridad de tu contraseña. Toda actividad realizada desde tu cuenta es tu responsabilidad.',
      'Una persona no puede operar varias cuentas para evadir sanciones o inscribirse de forma duplicada.',
    ],
  },
  {
    id: 'uso', title: '3. Uso aceptable y convivencia',
    body: [
      'Trata a los demás con respeto. Quedan prohibidos el acoso, el discurso de odio, las amenazas y cualquier conducta tóxica dentro y fuera de las partidas.',
      'Está prohibido el uso de trampas, exploits, software de terceros, cuentas de terceros (smurfing) o cualquier ventaja desleal.',
      'No publiques contenido ilegal, spam, malware ni enlaces engañosos. La plataforma puede moderar, ocultar o eliminar contenido que infrinja estas normas.',
    ],
  },
  {
    id: 'torneos', title: '4. Torneos, check-in y resultados',
    body: [
      'El check-in es obligatorio y se realiza en Discord mediante el bot oficial. Existen dos check-ins: el de presencia (confirmar participación) y el previo al torneo (preparación, ~30 min antes).',
      'Cuando un torneo admite "sobre cupo", los equipos en cola pueden entrar ante ausencias y se les abre un segundo check-in con una ventana de 6 a 12 horas definida por el organizador.',
      'Los resultados deben reportarse con su justificación (marcador y capturas de ambos equipos). El organizador y el staff validan los resultados; sus decisiones de arbitraje son finales salvo error manifiesto.',
      'Las reglas específicas (formato, mapas, desempates, sanciones) se publican en el reglamento de cada torneo y prevalecen para ese evento, sin contradecir estos términos generales.',
    ],
  },
  {
    id: 'pagos', title: '5. Planes, pagos y reembolsos',
    body: [
      'Algunos servicios (planes Pro, cuotas de inscripción) son de pago. Los precios e impuestos aplicables se muestran antes de confirmar.',
      'Las suscripciones se renuevan según el periodo contratado hasta que las canceles. Puedes cancelar en cualquier momento desde Ajustes; la cancelación aplica al siguiente ciclo.',
      'Las cuotas de inscripción a torneos son reembolsables solo según la política del organizador del evento o si el torneo se cancela.',
    ],
  },
  {
    id: 'premios', title: '6. Premios',
    body: [
      'Los premios, su naturaleza (dinero u objetos) y su reparto son responsabilidad del organizador del torneo, que debe contar con autorización para ofrecerlos.',
      'La entrega de premios puede requerir verificación de identidad y el cumplimiento de las reglas del evento. El incumplimiento o la trampa pueden conllevar la pérdida del premio.',
    ],
  },
  {
    id: 'datos', title: '7. Datos personales y privacidad',
    body: [
      'Recopilamos solo los datos necesarios para operar la plataforma: datos de cuenta (nick, correo), datos de juego y participación, y datos técnicos básicos.',
      'Usamos tus datos para gestionar tu cuenta, torneos, notificaciones, pagos y soporte. No vendemos tus datos personales.',
      'Integraciones como Discord o WhatsApp procesan datos según sus propias políticas cuando las conectas a un torneo.',
      'Puedes solicitar el acceso, la corrección o la eliminación de tus datos escribiendo al canal de soporte. Conservamos cierta información cuando la ley lo exige.',
    ],
  },
  {
    id: 'propiedad', title: '8. Propiedad intelectual y contenido del usuario',
    body: [
      'Las marcas, el diseño y el software de STELIANT ESPORTS pertenecen a la plataforma y a sus titulares. Los nombres de juegos y marcas de terceros pertenecen a sus respectivos dueños.',
      'El contenido que subes (logos, capturas, evidencias) sigue siendo tuyo, pero nos concedes una licencia para mostrarlo dentro de la plataforma con el fin de operar torneos, justificar resultados y difundir eventos.',
    ],
  },
  {
    id: 'responsabilidad', title: '9. Disponibilidad y responsabilidad',
    body: [
      'La plataforma se ofrece "tal cual". Procuramos su disponibilidad y comodidad, pero pueden existir interrupciones, mantenimientos o errores.',
      'En la medida permitida por la ley, no somos responsables de daños indirectos derivados del uso o de la imposibilidad de uso de la plataforma o de la organización de terceros.',
    ],
  },
  {
    id: 'sanciones', title: '10. Sanciones y suspensión',
    body: [
      'Podemos advertir, descalificar, suspender o eliminar cuentas que incumplan estos términos o el reglamento de un torneo, sin reembolso cuando proceda.',
      'Las conductas graves (trampa, fraude, acoso) pueden conllevar la expulsión permanente de la plataforma.',
    ],
  },
  {
    id: 'cambios', title: '11. Cambios y ley aplicable',
    body: [
      'Podemos actualizar estos términos. Si el cambio es relevante, lo notificaremos en la plataforma. El uso continuado implica la aceptación de la versión vigente.',
      'Estos términos se rigen por la legislación aplicable en la jurisdicción del organizador o de STELIANT ESPORTS, según corresponda. Para dudas o reclamos, usa el canal de soporte oficial.',
    ],
  },
]

export default function Terms() {
  return (
    <LegalDoc
      title="Términos y Condiciones"
      updated={UPDATED}
      intro="Incluye condiciones de uso, torneos, pagos, privacidad y datos."
      sections={SECTIONS}
    />
  )
}

