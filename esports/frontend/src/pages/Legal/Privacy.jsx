import LegalDoc from './LegalDoc.jsx'

const UPDATED = '5 de octubre de 2026'

const SECTIONS = [
  {
    id: 'responsable', title: '1. Responsable del tratamiento',
    body: [
      'STELIANT ESPORTS (operado por Steliant) es responsable del tratamiento de los datos personales que recopila a través de la plataforma.',
      'Para cualquier asunto de privacidad puedes escribir a soporte@glitchgang.com.',
    ],
  },
  {
    id: 'datos', title: '2. Qué datos recopilamos',
    body: [
      'Datos de cuenta: nick, correo, contraseña (cifrada), país, teléfono, fecha de nacimiento y género.',
      'Datos de juego: juegos elegidos, nivel, plataforma, equipos, inscripciones y resultados.',
      'Contenido que subes: logos, banners, capturas de evidencia y documentos de reglas.',
      'Datos técnicos: dirección IP, tipo de dispositivo/navegador y registros básicos de uso.',
      'Datos de pago: cuando haya pagos, los procesará un proveedor de pagos externo. No almacenamos los números completos de tarjeta.',
    ],
  },
  {
    id: 'uso', title: '3. Para qué usamos los datos',
    body: [
      'Crear y gestionar tu cuenta y tu participación en torneos.',
      'Operar el check-in, brackets, premios, notificaciones y soporte.',
      'Procesar pagos y prevenir fraude o trampas.',
      'Mejorar la plataforma y, si lo aceptas, enviarte comunicaciones.',
    ],
  },
  {
    id: 'base', title: '4. Base legal',
    body: [
      'Ejecución del contrato (usar la plataforma), tu consentimiento (comunicaciones), el interés legítimo (seguridad y mejora) y el cumplimiento de obligaciones legales.',
    ],
  },
  {
    id: 'comparticion', title: '5. Con quién compartimos',
    body: [
      'Proveedores que nos prestan servicio: pagos (cuando estén activos), correo (SMTP), almacenamiento y, si las conectas, integraciones como Discord o WhatsApp.',
      'Organizadores de torneos a los que te inscribes (ven los datos necesarios de tu equipo).',
      'No vendemos tus datos personales.',
    ],
  },
  {
    id: 'cookies', title: '6. Cookies y almacenamiento local',
    body: [
      'Solo usamos cookies esenciales: una cookie de sesión (HttpOnly, no accesible desde JavaScript) para mantenerte conectado y una cookie de seguridad (CSRF) que protege tus acciones.',
      'Guardamos en el almacenamiento local del navegador tus preferencias (idioma, tema, avisos ya vistos).',
      'No usamos cookies de publicidad, de analítica ni de rastreo de terceros. Si eso cambia, te pediremos consentimiento antes.',
    ],
  },
  {
    id: 'conservacion', title: '7. Conservación',
    body: [
      'Conservamos tus datos mientras tu cuenta esté activa y durante el tiempo necesario para cumplir obligaciones legales o resolver disputas.',
    ],
  },
  {
    id: 'derechos', title: '8. Tus derechos',
    body: [
      'Puedes solicitar acceso, corrección, eliminación, portabilidad u oposición al tratamiento de tus datos.',
      'Para ejercerlos, escribe a soporte@glitchgang.com. También puedes eliminar tu cuenta desde Ajustes.',
    ],
  },
  {
    id: 'seguridad', title: '9. Seguridad',
    body: [
      'Aplicamos medidas razonables (contraseñas cifradas, control de acceso). Ningún sistema es 100% infalible; te pedimos cuidar tu contraseña.',
    ],
  },
  {
    id: 'menores', title: '10. Menores de edad',
    body: [
      'La plataforma requiere la edad mínima legal de tu país o la indicada por cada torneo. No recopilamos datos de menores a sabiendas sin el consentimiento correspondiente.',
    ],
  },
  {
    id: 'cambios', title: '11. Cambios',
    body: [
      'Podemos actualizar esta política. Notificaremos los cambios relevantes en la plataforma.',
    ],
  },
]

export default function Privacy() {
  return (
    <LegalDoc
      title="Política de Privacidad"
      updated={UPDATED}
      intro="Cómo recopilamos, usamos y protegemos tus datos."
      sections={SECTIONS}
    />
  )
}

