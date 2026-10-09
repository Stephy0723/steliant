import LegalDoc from './LegalDoc.jsx'

const UPDATED = '8 de junio de 2026'

const SECTIONS = [
  {
    id: 'alcance', title: '1. Alcance',
    body: [
      'Esta política aplica a los pagos dentro de STELIANT ESPORTS: planes Pro, cuotas de inscripción a torneos y otros servicios de pago.',
    ],
  },
  {
    id: 'metodos', title: '2. Métodos y procesamiento',
    body: [
      'Los pagos se procesan a través de un proveedor seguro (Stripe). No almacenamos los datos completos de tu tarjeta.',
      'Los precios se muestran con la moneda e impuestos aplicables antes de confirmar la compra.',
    ],
  },
  {
    id: 'suscripciones', title: '3. Suscripciones (Plan Pro)',
    body: [
      'Las suscripciones se renuevan automáticamente al final de cada periodo hasta que las canceles.',
      'Puedes cancelar en cualquier momento desde Ajustes; el acceso continúa hasta el final del periodo ya pagado.',
    ],
  },
  {
    id: 'inscripciones', title: '4. Cuotas de inscripción a torneos',
    body: [
      'Cuando un torneo tiene cuota, el monto y las condiciones los define el organizador y se muestran antes de inscribirte.',
      'La cuota da derecho a un cupo; si no completas el check-in, el cupo puede cederse a la lista de espera según el reglamento del torneo.',
    ],
  },
  {
    id: 'reembolsos', title: '5. Reembolsos',
    body: [
      'Plan Pro: puedes solicitar reembolso dentro de las primeras 48 horas si no usaste beneficios exclusivos.',
      'Cuotas de torneo: son reembolsables si el torneo se cancela o según la política del organizador.',
      'No hay reembolso por descalificación derivada de trampa o incumplimiento del reglamento.',
    ],
  },
  {
    id: 'premios', title: '6. Premios y pagos a ganadores',
    body: [
      'La entrega de premios es responsabilidad del organizador, que debe contar con los fondos y autorizaciones.',
      'El pago de premios puede requerir verificación de identidad y el cumplimiento de las reglas del evento.',
    ],
  },
  {
    id: 'comisiones', title: '7. Comisiones',
    body: [
      'STELIANT ESPORTS puede aplicar una comisión de servicio sobre cuotas o ventas; cuando aplique, se informará de forma clara antes del pago.',
    ],
  },
  {
    id: 'disputas', title: '8. Disputas y contracargos',
    body: [
      'Si detectas un cobro indebido, contáctanos antes de iniciar un contracargo para resolverlo más rápido.',
      'Los contracargos fraudulentos pueden conllevar la suspensión de la cuenta.',
    ],
  },
  {
    id: 'impuestos', title: '9. Impuestos',
    body: [
      'Eres responsable de los impuestos que apliquen a tus premios o ingresos según tu jurisdicción.',
    ],
  },
  {
    id: 'cambios', title: '10. Cambios',
    body: [
      'Podemos actualizar esta política. Los cambios relevantes se notificarán en la plataforma.',
    ],
  },
]

export default function Payments() {
  return (
    <LegalDoc
      title="Política de Pagos"
      updated={UPDATED}
      intro="Planes, cuotas, reembolsos, premios y comisiones."
      sections={SECTIONS}
    />
  )
}

