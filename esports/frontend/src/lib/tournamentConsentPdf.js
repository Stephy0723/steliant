import { jsPDF } from 'jspdf'

export function createTournamentConsentPdf(form) {
  const doc = new jsPDF()
  const margin = 18
  const width = 174
  let y = 25
  const text = (value, size = 10, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    const lines = doc.splitTextToSize(String(value || '________________________'), width)
    for (const line of lines) {
      if (y > 270) { doc.addPage(); y = 25 }
      doc.text(line, margin, y)
      y += size * 0.45 + 1
    }
    y += 3
  }
  const section = (title) => { if (y > 240) { doc.addPage(); y = 25 } y += 3; text(title, 12, true) }
  const date = value => value ? `${String(value).replace('T', ' ').slice(0, 16)} (UTC${form.timezone})` : 'Pendiente de definir'
  text('STELIANT ESPORTS / AUTORIZACION DE MENORES', 15, true)
  text('Participacion, imagen, voz y contenido | Republica Dominicana', 11)
  text('PLANTILLA PARA REVISION LEGAL. Completar y firmar antes de participar. La descarga no acredita consentimiento ni autoriza automaticamente la participacion o la difusion.', 9, true)

  section('1. Torneo y entidad responsable')
  text(`Torneo: ${form.title}\nSerie: ${form.seasonName || form.title} / Temporada ${form.seasonNumber}\nJuego: ${form.game}\nOrganizacion: ${form.organizerBrandName}\nResponsable: ${form.organizationContact}\nDomicilio: ${form.organizationAddress}\nContacto: ${form.contactEmail} ${form.contactPhone || ''}`)
  text(`Inicio: ${date(form.date)}\nFin: ${date(form.endDate)}\nInscripciones: ${date(form.registrationStart)} hasta ${date(form.registrationEnd)}\nModalidad: ${form.modality} / ${form.format}\nServidor: ${form.server}\nEdad minima: ${form.minAge} anos\nInscripcion: ${form.entryFee || 0} ${form.currency}\nPremios: ${form.prizeType}, total ${form.prizePool || 0} ${form.currency}`)
  text(`Reglamento adjunto: ${form.rulesName || (form.rules ? 'Texto incluido al final de este documento' : 'Pendiente')}\nReferencia del documento: ${form.rulesDocument || 'Reglamento del torneo'}`)

  section('2. Menor y representante legal')
  text('Nombre del participante: __________________________________\nFecha de nacimiento: ______________  Nick / equipo: ______________\nRepresentante legal: ________________________________________\nRelacion y titulo de representacion: ____________________________\nTelefono y correo de contacto: _________________________________\nPersona y telefono para incidencias: ___________________________')
  text('Declaro que tengo facultades para representar al menor. La organizacion verificara esta condicion por un canal privado antes de aceptar la autorizacion. No publicar documentos de identidad, domicilios ni telefonos del menor.', 10)

  section('3. Participacion y condiciones')
  text('[ ] Autorizo la participacion en esta edicion, en las fechas y bajo el reglamento identificado. He revisado el juego, sus requisitos de edad, horarios, costo, premios y condiciones de cancelacion. La autorizacion no sustituye las condiciones del editor del juego ni permite actividades prohibidas por la normativa aplicable.')
  text('La organizacion mantendra un canal de incidencias y medidas de moderacion, privacidad y proteccion del menor. Se podra suspender la participacion ante una situacion de riesgo. Las consecuencias de cancelaciones y devoluciones deben estar definidas en el reglamento antes de la firma. No se garantiza la obtencion de premios.')
  text('[ ] El menor ha recibido una explicacion adecuada a su edad y desea participar. Observaciones o adaptaciones acordadas: ____________________')

  section('4. Permisos independientes de imagen, voz y contenido')
  text('Marcar SI o NO en cada uso. Una casilla vacia no equivale a consentimiento. El permiso de participacion no incluye publicidad ni cesion comercial de imagen.')
  text('[ ] SI  [ ] NO: transmision de partidas con nick y contenido de juego.\n[ ] SI  [ ] NO: grabacion y publicacion de rostro, voz o entrevistas.\n[ ] SI  [ ] NO: resumenes y publicaciones informativas de esta edicion.')
  text(`Canales autorizables: ${form.mediaChannels}\nPlazo propuesto: ${form.mediaRetentionMonths} meses desde el cierre del torneo.\nRestricciones particulares: ___________________________________`)
  text('Los usos se limitan a esta edicion y a los canales y fines elegidos. No se concede exclusividad ni se transfiere la propiedad del contenido. La publicidad de patrocinadores, nuevos fines y usos en otras temporadas requieren un acuerdo separado. No se autoriza contenido humillante, perjudicial o que invada la intimidad. Ante negativa, acordar anonimato u otra alternativa antes de participar; no asumir consentimiento por ingresar a la sala.')

  section('5. Datos personales y solicitudes')
  text(`La entidad responsable indicada arriba utilizara los datos necesarios para verificar elegibilidad, coordinar la participacion y documentar las autorizaciones. El acceso se limita al personal que necesite gestionar esas tareas. Consultas, acceso, correccion, supresion y retiro de permisos: ${form.complaintsChannel}.`)
  text(`Conservar las autorizaciones con acceso restringido durante el plazo acordado de ${form.mediaRetentionMonths} meses, salvo una obligacion legal justificada que deba informarse. No difundir la firma ni los datos de contacto. Antes de compartir datos con proveedores debe informarse quienes los recibiran y para que.`)
  text('El representante puede solicitar detener usos futuros y retirar publicaciones bajo control de la organizacion. Se explicaran los limites practicos de retirar emisiones ya realizadas o copias de terceros, sin excluir los derechos que correspondan. El cambio de temporada no renueva estos permisos.')

  section('6. Alcance y firmas')
  text('Este documento no exonera negligencia, incumplimientos legales ni vulneraciones de derechos del menor. Debe ser revisado por un profesional del derecho dominicano y adaptado al evento y a las exigencias del editor. Si el torneo se organiza bajo otra jurisdiccion, requiere una nueva revision.')
  text('Lugar y fecha: ____________________________________________\nFirma del representante: ____________________________________\nNombre y firma del responsable del torneo: _____________________\nAsentimiento del menor, segun edad y madurez: __________________\nVerificacion de representacion por: ______________ Fecha: _______')
  section('Referencias de revision')
  text('Ley 136-03, art. 26: proteccion de imagen e intimidad del menor. Ley 172-13: informacion, consentimiento y derechos sobre datos personales. Estas referencias no constituyen una certificacion de validez del documento.', 9)
  doc.setFontSize(9)
  doc.textWithLink('CONANI: Ley 136-03', margin, y, { url: 'https://conani.gob.do/archivo/ley-136-03/' }); y += 7
  doc.textWithLink('INDOTEL: Ley 172-13', margin, y, { url: 'https://indotel.gob.do/wp-content/uploads/2025/04/Ley-172-13-Sobre-proteccion-de-Datos-personales.pdf' }); y += 10
  if (form.rules) { section('Anexo: reglamento de esta edicion'); text(form.rules) }
  const total = doc.getNumberOfPages()
  for (let page = 1; page <= total; page++) {
    doc.setPage(page)
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(`Autorizacion de menores | ${page} / ${total} | No firmada`, margin, 286)
  }
  return doc
}

export function downloadTournamentConsent(form) {
  const doc = createTournamentConsentPdf(form)
  doc.save(`autorizacion-menores-temporada-${form.seasonNumber}.pdf`)
}

