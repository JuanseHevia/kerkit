import type { SignalPattern } from '@kerkit/core';

/**
 * Email classification rules for the Argentine obra social workflow,
 * generalized from patterns proven in production against a real treatment.
 *
 * Subject vocabulary is the portable part — obras sociales and clinics use
 * remarkably consistent Spanish ("aprobada", "en preparación", "lista para
 * retirar"). Sender patterns ship as generic department heuristics; apps
 * should narrow them per institution (kerkit models this as
 * institution-level pattern rows, which take priority).
 */
export const signalPatterns: SignalPattern[] = [
  {
    // Approval emails often arrive from a generic "comunicaciones@" address,
    // not only an "autorizaciones@" one.
    senderPattern: 'autorizaciones|obra ?social|prestaciones|comunicaciones',
    subjectPattern: 'aprobad[ao]|autorizad[ao]|autorizaci[oó]n(es)? aprobad',
    signalType: 'auth_approved',
    suggestedActionTemplate: 'La autorización fue aprobada. Marcala como confirmada en el trámite.',
    priority: 10,
  },
  {
    senderPattern: 'autorizaciones|obra ?social|prestaciones|comunicaciones',
    subjectPattern: 'en preparaci[oó]n|preparando|procesando',
    signalType: 'auth_preparing',
    suggestedActionTemplate: 'La obra social está preparando el pedido. No hace falta hacer nada todavía.',
    priority: 8,
  },
  {
    senderPattern: 'autorizaciones|farmacia|droguer[ií]a|comunicaciones|provisi[oó]n',
    subjectPattern: 'list[oa] para retir|list[oa] para entregar|para entregar|disponible para retir|disponible',
    signalType: 'med_ready_for_pickup',
    suggestedActionTemplate: 'La medicación está lista para retirar o entregar. Coordiná la entrega antes de la próxima sesión.',
    priority: 9,
  },
  {
    senderPattern: 'autorizaciones|farmacia|droguer[ií]a|log[ií]stica',
    subjectPattern: 'comprobante de env[ií]o|env[ií]o realizado|entregad[oa]',
    signalType: 'med_delivery_confirmed',
    suggestedActionTemplate: 'La medicación fue enviada o entregada. Verificá la recepción.',
    priority: 9,
  },
  {
    senderPattern: 'autorizaciones|obra ?social|prestaciones',
    subjectPattern: 'documentaci[oó]n|faltan? documento',
    signalType: 'auth_docs_needed',
    suggestedActionTemplate: 'Piden documentación para avanzar. Revisá el mail y mandá lo que falta cuanto antes.',
    priority: 10,
  },
  {
    senderPattern: 'autorizaciones|obra ?social|prestaciones',
    subjectPattern: 'no requiere autorizaci[oó]n',
    signalType: 'auth_not_required',
    suggestedActionTemplate: 'Esta prestación no requiere autorización. Podés cerrar el trámite.',
    priority: 8,
  },
  {
    senderPattern: 'autorizaciones|obra ?social|prestaciones',
    subjectPattern: 'autorizaci[oó]n.*pdf|pdf.*autorizaci[oó]n|adjunt.*autorizaci[oó]n',
    signalType: 'auth_pdf_received',
    suggestedActionTemplate: 'Llegó el PDF de la autorización. Guardalo y llevalo el día del turno.',
    priority: 9,
  },
  {
    senderPattern: 'farmacia|droguer[ií]a|hospital de d[ií]a',
    subjectPattern: 'faltante|sin stock|demora de entrega',
    signalType: 'med_shortage',
    suggestedActionTemplate: 'Hay un faltante de medicación. Llamá a la farmacia y avisá al equipo médico si afecta la próxima sesión.',
    priority: 10,
  },
  {
    // Result notifications frequently come from a generic "notificaciones@".
    senderPattern: 'im[aá]genes|diagn[oó]stico|resultados|notificaciones',
    subjectPattern: 'informe|resultado|estudio',
    signalType: 'report_available',
    suggestedActionTemplate: 'Hay un informe disponible. Descargalo y guardalo para la próxima consulta.',
    priority: 7,
  },
  {
    senderPattern: 'laboratorio|resultados',
    subjectPattern: 'laboratorio|resultado.*lab|an[aá]lisis',
    signalType: 'lab_results_available',
    suggestedActionTemplate: 'Llegaron resultados de laboratorio. Guardalos para la próxima consulta.',
    priority: 7,
  },
  {
    // "Nueva receta" and "Nueva orden" both originate the medication chain.
    senderPattern: 'recetario|prescripci[oó]n|recetas?',
    subjectPattern: 'receta|prescripci[oó]n|nueva orden|\\borden\\b',
    signalType: 'prescription_detected',
    suggestedActionTemplate: 'Llegó una receta u orden nueva. Cargala para seguir su vencimiento y la autorización si hace falta.',
    priority: 8,
  },
  {
    senderPattern: 'turnos|citas|recordatorios?',
    subjectPattern: 'turno|cita|recordatorio',
    signalType: 'appointment_reminder',
    suggestedActionTemplate: 'Recordatorio de turno. Verificá que esté en el calendario con la autorización al día.',
    priority: 5,
  },
];
