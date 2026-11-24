/**
 * Nette tekens bij het tonen van teksten uit de data: ' wordt ’ ("euro’s", "’s avonds") en
 * "…" wordt „…”. Alleen voor weergave: de paklijstnamen zelf blijven ongewijzigd, want daarmee
 * worden je vinkjes bewaard.
 */
export function netjes(tekst: string): string {
  return tekst
    .replace(/(^|[\s(])'(s|t|n)\b/g, '$1\u2019$2')
    .replace(/([\p{L}])'(\p{L})/gu, '$1\u2019$2')
    .replace(/"([^"]*)"/g, '\u201e$1\u201d')
}
