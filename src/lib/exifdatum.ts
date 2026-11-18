/*
 * Opnamemoment uit de EXIF-gegevens van een JPEG (DateTimeOriginal, met OffsetTimeOriginal als die
 * er is). Alleen dat ene veld: de rest van de EXIF (zoals de locatie) verdwijnt bij het verkleinen.
 * Geen afhankelijkheden, zodat scripts/exifdatum.test.mjs hem rechtstreeks kan testen.
 */

export interface ExifDatum {
  /** 'JJJJ-MM-DDTUU:MM:SS' zoals de camera hem opgaf (lokale tijd van de telefoon) */
  lokaal: string
  /** Bijvoorbeeld '+01:00', als de telefoon dat meeschreef */
  offset: string | null
}

const DATUM = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/
const OFFSET = /^[+-]\d{2}:\d{2}$/

/** Leest de opnamedatum uit (het begin van) een JPEG-bestand; null als er geen bruikbare is */
export function leesExifDatum(buf: ArrayBuffer): ExifDatum | null {
  const v = new DataView(buf)
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null
  let p = 2
  while (p + 4 <= v.byteLength) {
    const marker = v.getUint16(p)
    if ((marker & 0xff00) !== 0xff00) return null
    // Begin van de beelddata: geen EXIF meer te verwachten
    if (marker === 0xffda || marker === 0xffd9) return null
    const lengte = v.getUint16(p + 2)
    if (marker === 0xffe1 && p + 10 <= v.byteLength && v.getUint32(p + 4) === 0x45786966 && v.getUint16(p + 8) === 0) {
      return leesTiff(v, p + 10, Math.min(v.byteLength, p + 2 + lengte))
    }
    p += 2 + lengte
  }
  return null
}

function leesTiff(v: DataView, begin: number, einde: number): ExifDatum | null {
  if (begin + 8 > einde) return null
  const orde = v.getUint16(begin)
  if (orde !== 0x4949 && orde !== 0x4d4d) return null
  const le = orde === 0x4949
  const binnen = (o: number, n: number) => o >= 0 && begin + o + n <= einde
  const u16 = (o: number) => (binnen(o, 2) ? v.getUint16(begin + o, le) : -1)
  const u32 = (o: number) => (binnen(o, 4) ? v.getUint32(begin + o, le) : -1)

  /** Waarden van de gevraagde tags in één IFD: getal (LONG) of tekst (ASCII) */
  const ifd = (o: number, tags: number[]) => {
    const uit = new Map<number, number | string>()
    const n = u16(o)
    if (n < 0 || n > 500) return uit
    for (let i = 0; i < n; i++) {
      const e = o + 2 + i * 12
      const tag = u16(e)
      if (tag < 0) break
      if (!tags.includes(tag)) continue
      const type = u16(e + 2)
      const aantal = u32(e + 4)
      if (type === 4 && aantal === 1) uit.set(tag, u32(e + 8))
      if (type === 2 && aantal > 0 && aantal < 64) {
        const plek = aantal > 4 ? u32(e + 8) : e + 8
        if (!binnen(plek, aantal)) continue
        let tekst = ''
        for (let k = 0; k < aantal; k++) {
          const c = v.getUint8(begin + plek + k)
          if (c === 0) break
          tekst += String.fromCharCode(c)
        }
        uit.set(tag, tekst)
      }
    }
    return uit
  }

  const ifd0 = ifd(u32(4), [0x8769, 0x0132])
  const exifPlek = ifd0.get(0x8769)
  const exif = typeof exifPlek === 'number' && exifPlek > 0 ? ifd(exifPlek, [0x9003, 0x9011]) : new Map()
  // Liever het moment van de opname; DateTime (wijzigingsdatum) alleen als terugval
  const ruw = (exif.get(0x9003) ?? ifd0.get(0x0132)) as string | undefined
  const m = typeof ruw === 'string' ? DATUM.exec(ruw) : null
  if (!m || Number(m[1]) < 2000 || m[2] === '00' || m[3] === '00') return null
  const offset = exif.get(0x9011)
  return {
    lokaal: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`,
    offset: typeof offset === 'string' && OFFSET.test(offset) ? offset : null,
  }
}
