/*
 * Een zip-bestand maken zonder extra pakket. Foto's zijn al JPEG (gecomprimeerd), dus ze gaan er
 * ongecomprimeerd in ("stored"); dat is snel en zuinig met de batterij. Namen in UTF-8, de datum
 * van elk bestand = wanneer de foto genomen is, zodat fotoprogramma's ze goed sorteren.
 * Grenzen: minder dan 65.535 bestanden en kleiner dan 4 GB (ruim genoeg voor de reis).
 * Geen afhankelijkheden, zodat scripts/zip.test.mjs hem rechtstreeks kan testen.
 */

const CRC_TABEL = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABEL[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Datum en tijd in het MS-DOS-formaat van zip (lokale tijd, op 2 seconden) */
function dosTijd(d: Date) {
  const jaar = Math.min(2107, Math.max(1980, d.getFullYear()))
  return {
    tijd: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    datum: ((jaar - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

export class ZipMaker {
  private delen: BlobPart[] = []
  private centraal: Uint8Array[] = []
  private plek = 0
  private aantal = 0
  private namen = new Set<string>()

  /** Unieke naam: bij een dubbele naam komt er ' (2)' enz. voor de extensie */
  private uniek(naam: string) {
    let n = naam
    for (let i = 2; this.namen.has(n.toLowerCase()); i++) n = naam.replace(/(\.[^./]*)?$/, ` (${i})$1`)
    this.namen.add(n.toLowerCase())
    return n
  }

  voegToe(naam: string, data: Uint8Array, datum = new Date()) {
    if (this.aantal >= 65535) throw new Error('Te veel bestanden voor één zip')
    if (this.plek + data.length > 0xfffffff0) throw new Error('De zip wordt te groot')
    const naamBytes = new TextEncoder().encode(this.uniek(naam))
    const crc = crc32(data)
    const { tijd, datum: dag } = dosTijd(datum)

    const kop = new DataView(new ArrayBuffer(30))
    kop.setUint32(0, 0x04034b50, true)
    kop.setUint16(4, 20, true) // versie nodig
    kop.setUint16(6, 0x0800, true) // namen in UTF-8
    kop.setUint16(8, 0, true) // stored
    kop.setUint16(10, tijd, true)
    kop.setUint16(12, dag, true)
    kop.setUint32(14, crc, true)
    kop.setUint32(18, data.length, true)
    kop.setUint32(22, data.length, true)
    kop.setUint16(26, naamBytes.length, true)
    kop.setUint16(28, 0, true)

    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true)
    c.setUint16(4, 20, true) // gemaakt met
    c.setUint16(6, 20, true)
    c.setUint16(8, 0x0800, true)
    c.setUint16(10, 0, true)
    c.setUint16(12, tijd, true)
    c.setUint16(14, dag, true)
    c.setUint32(16, crc, true)
    c.setUint32(20, data.length, true)
    c.setUint32(24, data.length, true)
    c.setUint16(28, naamBytes.length, true)
    c.setUint32(42, this.plek, true) // waar de lokale kop begint
    const regel = new Uint8Array(46 + naamBytes.length)
    regel.set(new Uint8Array(c.buffer), 0)
    regel.set(naamBytes, 46)
    this.centraal.push(regel)

    this.delen.push(new Uint8Array(kop.buffer), naamBytes, data)
    this.plek += 30 + naamBytes.length + data.length
    this.aantal++
  }

  get aantalBestanden() {
    return this.aantal
  }

  /** Alles tot nu toe als één zip */
  blob(): Blob {
    const grootte = this.centraal.reduce((n, r) => n + r.length, 0)
    const eind = new DataView(new ArrayBuffer(22))
    eind.setUint32(0, 0x06054b50, true)
    eind.setUint16(8, this.aantal, true)
    eind.setUint16(10, this.aantal, true)
    eind.setUint32(12, grootte, true)
    eind.setUint32(16, this.plek, true)
    return new Blob([...this.delen, ...this.centraal, new Uint8Array(eind.buffer)] as BlobPart[], { type: 'application/zip' })
  }
}

/** Veilige bestands- of mapnaam (Windows, iPhone en Android) */
export function veiligeNaam(tekst: string, max = 60) {
  const schoon = tekst
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
  return schoon.slice(0, max).trim() || 'foto'
}
