export const R2_REFERENCE_PREFIX = "r2:";

export const isR2Reference = (value?: string | null) =>
  typeof value === "string" && value.startsWith(R2_REFERENCE_PREFIX);

export const toR2Reference = (key: string) => `${R2_REFERENCE_PREFIX}${key}`;

export const fromR2Reference = (value: string) =>
  value.slice(R2_REFERENCE_PREFIX.length);
