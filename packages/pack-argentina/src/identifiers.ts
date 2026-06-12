/**
 * Argentine identifier patterns, fed to the privacy sweep pass
 * (@kerkit/core sweepText). Anything matching these inside free text —
 * note contents, email subjects — is redacted before reaching an LLM.
 */
export const identifierPatterns: RegExp[] = [
  // DNI with dots: 12.345.678 (7-8 digits)
  /\b\d{1,2}\.\d{3}\.\d{3}\b/,
  // DNI written with the label, dotted or not: "DNI 12345678", "D.N.I.: 12.345.678"
  /\bD\.?N\.?I\.?:?\s*\d{1,2}\.?\d{3}\.?\d{3}\b/i,
  // CUIL/CUIT: 20-12345678-3 (with or without dashes when labeled)
  /\b(20|23|24|25|26|27|30|33|34)-\d{8}-\d\b/,
  /\bCUI[LT]:?\s*(20|23|24|25|26|27|30|33|34)-?\d{8}-?\d\b/i,
  // Credential / affiliate numbers when labeled: "credencial 123456789", "afiliado Nº 12345678"
  /\b(credencial|afiliad[oa])\s*(n[°º.]?\s*)?:?\s*[\dA-Z][\dA-Z\-\/.]{5,}\b/i,
];
