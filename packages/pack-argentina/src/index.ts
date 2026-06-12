import type { LocalePack } from '@kerkit/core';
import { strings } from './strings.js';
import { insurers } from './insurers.js';
import { signalPatterns } from './signal-patterns.js';
import { identifierPatterns } from './identifiers.js';

export { strings } from './strings.js';
export { insurers } from './insurers.js';
export { signalPatterns } from './signal-patterns.js';
export { identifierPatterns } from './identifiers.js';

/**
 * The Argentina locale pack — the reference implementation of kerkit's
 * LocalePack interface. Fork this package as the template for other locales.
 */
export const argentina: LocalePack = {
  locale: 'es-AR',
  strings,
  insurers,
  signalPatterns,
  identifierPatterns,
  rules: {
    // A receta is customarily valid for 30 days from issue.
    prescriptionValidityDays: 30,
    prescriptionAlertWindowDays: 5,
    authorizationDeadlineHours: 48,
  },
  prompts: {
    tone: strings['prompt.tone.description'],
    examples: [
      {
        situation:
          'El usuario pregunta: "¿Cómo viene el trámite de la medicación para el ciclo que viene?"',
        goodResponse:
          'El trámite está solicitado desde el 22/1 y la obra social todavía no confirmó. El turno es el 10/2, así que conviene llamar a Autorizaciones esta semana si no llega novedad. ¿Querés que te deje el teléfono a mano?',
      },
      {
        situation:
          'El usuario escribe de noche, cansado: "no me acuerdo si tenía que llevar algo al turno de mañana"',
        goodResponse:
          'Para el turno de mañana a las 11 tenés anotado: llevar el último análisis de sangre. La autorización ya está confirmada, no hace falta nada más. Descansá tranquilo.',
      },
      {
        situation: 'El usuario pregunta si un síntoma es normal después de la sesión.',
        goodResponse:
          'Eso lo tiene que evaluar el equipo médico — no es algo que yo pueda responder. Si querés, te dejo el teléfono de la clínica, y podés anotarlo acá para preguntarlo en la consulta del jueves.',
      },
    ],
  },
};

export default argentina;
