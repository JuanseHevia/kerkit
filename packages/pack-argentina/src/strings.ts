import type { CopyKey } from '@kerkit/core';

/**
 * es-AR copy, voseo throughout. Warm, attentive, precise — competence over
 * empathy performance. These strings were shaped against real caretaker use.
 */
export const strings: Record<CopyKey, string> = {
  // Appointment statuses
  'status.appointment.upcoming': 'Programado',
  'status.appointment.completed': 'Completado',
  'status.appointment.cancelled': 'Cancelado',
  'status.appointment.rescheduled': 'Reprogramado',

  // Authorization statuses
  'status.authorization.needed': 'Pendiente de inicio',
  'status.authorization.requested': 'Solicitado',
  'status.authorization.pending': 'En proceso',
  'status.authorization.confirmed': 'Confirmado',
  'status.authorization.escalation': 'Necesita atención',

  // Authorization badge labels (compact, uppercase by convention)
  'status.authorization.badge.needed': 'PENDIENTE',
  'status.authorization.badge.requested': 'SOLICITADO',
  'status.authorization.badge.pending': 'EN PROCESO',
  'status.authorization.badge.confirmed': 'CONFIRMADO',
  'status.authorization.badge.escalation': 'ATENCIÓN',

  // Prescription statuses
  'status.prescription.active': 'Vigente',
  'status.prescription.expiring': 'Por vencer',
  'status.prescription.expired': 'Vencida',
  'status.prescription.renewed': 'Renovada',

  // Care-event kinds
  'careEvent.chemo': 'Quimioterapia',
  'careEvent.imaging': 'Estudio por imágenes',
  'careEvent.consultation': 'Consulta médica',
  'careEvent.procedure': 'Procedimiento',
  'careEvent.lab': 'Laboratorio',
  'careEvent.ambulatory_medication': 'Aplicación en hospital de día',
  'careEvent.other': 'Otro',

  // Assistant prompt blocks
  'prompt.privacy.neverAskIdentifiers':
    'Nunca le pidas al usuario datos identificatorios (DNI, número de credencial, datos de acceso). Si los necesitás para una gestión, indicale dónde encontrarlos, pero no le pidas que te los escriba.',
  'prompt.privacy.dontEchoSensitive':
    'Si el usuario comparte un dato sensible por su cuenta, reconocé el mensaje y seguí ayudando, pero no repitas el dato en tu respuesta.',
  'prompt.privacy.transparency':
    'Si el usuario pregunta qué información guardás, explicale que puede ver y borrar todo lo que guardó desde la configuración de la app.',
  'prompt.boundaries.notMedicalAdvice':
    'No das consejo médico, diagnósticos ni indicaciones de tratamiento. Ante cualquier consulta clínica, indicá con calidez que eso lo tiene que responder el equipo médico. Tu terreno es la logística: turnos, trámites, recetas, papeles.',
  'prompt.tone.description':
    'Hablás en español rioplatense, con voseo natural ("tenés", "podés", "mirá"). Sos cálido, atento y preciso: demostrás competencia con datos concretos (fechas, nombres, lugares), no con frases de ocasión. Respondés corto y al punto, y siempre dejás claro el próximo paso.',
};
