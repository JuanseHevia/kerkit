import type { PiiCorpusCase } from '@kerkit/core';

/** Synthetic, versioned adversarial corpus. Never add production-derived values. */
export const ARGENTINA_PII_CORPUS_VERSION = 'es-ar-v1';

export const argentinaPiiCorpusV1: PiiCorpusCase[] = [
  { id: 'dni-dotted-8', input: 'Paciente DNI 12.345.678', type: 'dni', confidence: 'high', shouldDetect: true },
  { id: 'dni-dotted-7', input: 'Documento 1.234.567', type: 'dni', confidence: 'high', shouldDetect: true },
  { id: 'dni-label-plain', input: 'DNI: 12345678', type: 'dni', confidence: 'high', shouldDetect: true },
  { id: 'dni-label-punct', input: 'D.N.I. 12.345.678', type: 'dni', confidence: 'high', shouldDetect: true },
  { id: 'dni-label-spaced', input: 'DNI 1 2 3 4 5 6 7 8', type: 'dni', confidence: 'high', shouldDetect: true },
  { id: 'dni-zero-width', input: 'DNI 12\u200B345\u200B678', type: 'dni', confidence: 'high', shouldDetect: true },
  { id: 'dni-fullwidth', input: 'DNI １２３４５６７８', type: 'dni', confidence: 'high', shouldDetect: true },
  { id: 'dni-unlabeled', input: 'El documento es 12345678', type: 'dni', confidence: 'heuristic', shouldDetect: true },
  { id: 'cuil-valid-dashed', input: 'CUIL 20-12345678-6', type: 'cuil-cuit', confidence: 'high', shouldDetect: true },
  { id: 'cuit-valid-plain', input: 'CUIT: 20123456786', type: 'cuil-cuit', confidence: 'high', shouldDetect: true },
  { id: 'cuil-valid-spaced', input: 'CUIL 20 - 12345678 - 6', type: 'cuil-cuit', confidence: 'high', shouldDetect: true },
  { id: 'cuil-valid-digit-spaced', input: 'CUIL 2 0 - 1 2 3 4 5 6 7 8 - 6', type: 'cuil-cuit', confidence: 'high', shouldDetect: true },
  { id: 'cuil-invalid-shaped', input: 'CUIL 20-12345678-3', type: 'cuil-cuit', confidence: 'heuristic', shouldDetect: true },
  { id: 'email-simple', input: 'Escribí a persona.demo@example.com', type: 'email', confidence: 'high', shouldDetect: true },
  { id: 'email-plus', input: 'Mail: carlos+turnos@demo.example.org', type: 'email', confidence: 'high', shouldDetect: true },
  { id: 'phone-labeled-landline', input: 'Teléfono: 011 4321-5678', type: 'phone', confidence: 'high', shouldDetect: true },
  { id: 'phone-labeled-mobile', input: 'Celular: 11 5555 1234', type: 'phone', confidence: 'high', shouldDetect: true },
  { id: 'phone-whatsapp', input: 'WhatsApp +54 9 11 5555-1234', type: 'phone', confidence: 'high', shouldDetect: true },
  { id: 'phone-international', input: 'Contactar al +54 11 4321 5678', type: 'phone', confidence: 'heuristic', shouldDetect: true },
  { id: 'credential-number', input: 'Credencial Nº 123456789', type: 'credential', confidence: 'high', shouldDetect: true },
  { id: 'affiliate-mixed', input: 'Afiliada: AB-123456/7', type: 'credential', confidence: 'high', shouldDetect: true },
  { id: 'address-street', input: 'Domicilio: Calle Falsa 123', type: 'address', confidence: 'heuristic', shouldDetect: true },
  { id: 'address-avenue', input: 'Dirección Av. Siempreviva 742', type: 'address', confidence: 'heuristic', shouldDetect: true },
  { id: 'ocr-dni-letter-substitution', input: 'DNI 12.34S.678', type: 'dni', confidence: 'heuristic', shouldDetect: true },
  { id: 'fp-date', input: 'Turno el 12/03/2026 a las 10:30', shouldDetect: false },
  { id: 'fp-order', input: 'Orden interna 123456, estado pendiente', shouldDetect: false },
  { id: 'fp-medication', input: 'Medicamento Demo 50mg, caja por 30', shouldDetect: false },
  { id: 'fp-time', input: 'Llamar de 0800 a 0900', shouldDetect: false },
];
