import type { PiiPattern } from '@kerkit/core';

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Argentine CUIL/CUIT mod-11 validation. */
export function isValidCuilCuit(value: string): boolean {
  const number = digits(value);
  if (!/^\d{11}$/.test(number)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((total, weight, index) => total + Number(number[index]) * weight, 0);
  const remainder = 11 - (sum % 11);
  const check = remainder === 11 ? 0 : remainder === 10 ? 9 : remainder;
  return check === Number(number[10]);
}

/**
 * Typed es-AR patterns. High-confidence cases block CI at 100% corpus recall;
 * heuristic cases are still redacted but reported separately to track false
 * positives while the corpus matures.
 */
export const identifierPatterns: PiiPattern[] = [
  {
    id: 'ar-dni-dotted',
    type: 'dni',
    confidence: 'high',
    pattern: /\b\d{1,2}\s*\.\s*\d{3}\s*\.\s*\d{3}\b/,
  },
  {
    id: 'ar-dni-labeled',
    type: 'dni',
    confidence: 'high',
    pattern: /\bD\s*\.?\s*N\s*\.?\s*I\s*\.?\s*:?\s*\d(?:[\s.]?\d){6,7}\b/i,
  },
  {
    id: 'ar-dni-undotted',
    type: 'dni',
    confidence: 'heuristic',
    pattern: /(?<![\d-])\d{7,8}(?![\d-])/,
  },
  {
    id: 'ar-cuil-cuit-valid',
    type: 'cuil-cuit',
    confidence: 'high',
    pattern: /\b(?:CUI[LT]\s*:?\s*)?(?:20|23|24|25|26|27|30|33|34)\s*-?\s*\d{8}\s*-?\s*\d\b/i,
    validate: isValidCuilCuit,
  },
  {
    id: 'ar-cuil-cuit-shaped',
    type: 'cuil-cuit',
    confidence: 'heuristic',
    pattern: /\bCUI[LT]\s*:?\s*(?:20|23|24|25|26|27|30|33|34)\s*-?\s*\d{8}\s*-?\s*\d\b/i,
    validate: (value) => !isValidCuilCuit(value),
  },
  {
    id: 'ar-email',
    type: 'email',
    confidence: 'high',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  },
  {
    id: 'ar-phone-labeled',
    type: 'phone',
    confidence: 'high',
    pattern: /\b(?:tel(?:éfono)?|cel(?:ular)?|whatsapp)\s*:?\s*(?:\+?54\s*)?(?:\(?0?\d{2,4}\)?[\s.-]*)?\d{3,4}[\s.-]*\d{4}\b/i,
  },
  {
    id: 'ar-phone-international',
    type: 'phone',
    confidence: 'heuristic',
    pattern: /(?<!\d)\+54\s*(?:9\s*)?(?:\(?\d{2,4}\)?[\s.-]*)?\d{3,4}[\s.-]*\d{4}(?!\d)/,
  },
  {
    id: 'ar-credential-labeled',
    type: 'credential',
    confidence: 'high',
    pattern: /\b(?:credencial|afiliad[oa])\s*(?:n[°º.]?\s*)?:?\s*[\dA-Z][\dA-Z\s\-/.]{5,}\b/i,
  },
  {
    id: 'ar-address-labeled',
    type: 'address',
    confidence: 'heuristic',
    pattern: /\b(?:domicilio|dirección|calle|av(?:enida)?\.?|ruta)\s*:?\s*[A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 .'-]{2,}\s+\d{1,5}\b/i,
  },
];
