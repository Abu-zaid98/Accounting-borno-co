export const toWesternDigits = (str: string): string =>
  str.replace(/[٠-٩]/g, d => (d.charCodeAt(0) - 1632).toString());
