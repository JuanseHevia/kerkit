import type { DataClass, Disposition } from '../lib/types';

interface ClassStyle {
  label: string;
  /** Short gloss for the legend. */
  gloss: string;
  text: string;
  bg: string;
}

export const DATA_CLASS: Record<DataClass, ClassStyle> = {
  'direct-identifier': {
    label: 'Identificador directo',
    gloss: 'Se reemplaza por un token. El valor real nunca sale del dispositivo.',
    text: 'var(--dc-direct)',
    bg: 'var(--dc-direct-bg)',
  },
  'sensitive-health': {
    label: 'Dato de salud',
    gloss: 'Se omite salvo opt-in explícito y por escrito en el código.',
    text: 'var(--dc-sensitive)',
    bg: 'var(--dc-sensitive-bg)',
  },
  logistics: {
    label: 'Logística',
    gloss: 'Datos de coordinación del cuidado. Pasan al modelo.',
    text: 'var(--dc-logistics)',
    bg: 'var(--dc-logistics-bg)',
  },
  public: {
    label: 'Público',
    gloss: 'Metadatos no sensibles (timestamps, flags).',
    text: 'var(--dc-public)',
    bg: 'var(--dc-public-bg)',
  },
};

interface DispoStyle {
  label: string;
  tone: 'token' | 'gate' | 'drop' | 'pass' | 'empty';
}

export const DISPOSITION: Record<Disposition, DispoStyle> = {
  tokenized: { label: 'tokenizado', tone: 'token' },
  allowed: { label: 'permitido (opt-in)', tone: 'gate' },
  dropped: { label: 'omitido', tone: 'drop' },
  passthrough: { label: 'pasa', tone: 'pass' },
  swept: { label: 'barrido', tone: 'token' },
  empty: { label: 'vacío', tone: 'empty' },
};
