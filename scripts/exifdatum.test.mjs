// Tests voor het uitlezen van het opnamemoment uit een JPEG: `npm test`
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leesExifDatum } from '../src/lib/exifdatum.ts'

/**
 * Bouwt een minimale JPEG (SOI + APP1/Exif + SOS) met de gevraagde tags.
 * ifd0 / exif: lijst van [tag, tekst] (ASCII) ; de pointer naar de Exif-IFD komt er vanzelf bij.
 */
function jpeg({ le = true, ifd0 = [], exif = [], voor = [] } = {}) {
  const tiff = []
  const zet16 = (a, o, v) => (le ? ((a[o] = v & 0xff), (a[o + 1] = v >> 8)) : ((a[o] = v >> 8), (a[o + 1] = v & 0xff)))
  const zet32 = (a, o, v) => {
    const b = [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]
    for (let i = 0; i < 4; i++) a[o + i] = le ? b[3 - i] : b[i]
  }
  // Kop: byte-volgorde, 42, IFD0 op 8
  const kop = new Array(8).fill(0)
  kop[0] = kop[1] = le ? 0x49 : 0x4d
  zet16(kop, 2, 42)
  zet32(kop, 4, 8)
  tiff.push(...kop)

  const ifdGrootte = (n) => 2 + n * 12 + 4
  const tags0 = [...ifd0, ...(exif.length ? [[0x8769, null]] : [])]
  const ifd0Plek = 8
  const exifPlek = ifd0Plek + ifdGrootte(tags0.length)
  let data = exifPlek + (exif.length ? ifdGrootte(exif.length) : 0)
  const extra = []

  const schrijfIfd = (tags, plek) => {
    const a = new Array(ifdGrootte(tags.length)).fill(0)
    zet16(a, 0, tags.length)
    tags.forEach(([tag, tekst], i) => {
      const e = 2 + i * 12
      zet16(a, e, tag)
      if (tekst === null) {
        zet16(a, e + 2, 4)
        zet32(a, e + 4, 1)
        zet32(a, e + 8, exifPlek)
      } else {
        const bytes = [...tekst].map((c) => c.charCodeAt(0)).concat(0)
        zet16(a, e + 2, 2)
        zet32(a, e + 4, bytes.length)
        if (bytes.length <= 4) bytes.forEach((b, k) => (a[e + 8 + k] = b))
        else {
          zet32(a, e + 8, data)
          extra.push(...bytes)
          data += bytes.length
        }
      }
    })
    return a
  }
  tiff.push(...schrijfIfd(tags0, ifd0Plek))
  if (exif.length) tiff.push(...schrijfIfd(exif, exifPlek))
  tiff.push(...extra)

  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]
  const lengte = app1.length + 2
  const bytes = [0xff, 0xd8, ...voor, 0xff, 0xe1, lengte >> 8, lengte & 0xff, ...app1, 0xff, 0xda, 0, 2]
  return new Uint8Array(bytes).buffer
}

test('DateTimeOriginal met tijdzone (little-endian, zoals iPhone)', () => {
  const buf = jpeg({ exif: [[0x9003, '2027:03:07 14:32:10'], [0x9011, '+01:00']] })
  assert.deepEqual(leesExifDatum(buf), { lokaal: '2027-03-07T14:32:10', offset: '+01:00' })
})

test('DateTimeOriginal zonder tijdzone (big-endian, zoals veel Android-camera’s)', () => {
  const buf = jpeg({ le: false, exif: [[0x9003, '2027:03:09 08:05:00']] })
  assert.deepEqual(leesExifDatum(buf), { lokaal: '2027-03-09T08:05:00', offset: null })
})

test('opnamemoment gaat voor de wijzigingsdatum', () => {
  const buf = jpeg({ ifd0: [[0x0132, '2027:03:20 10:00:00']], exif: [[0x9003, '2027:03:08 16:40:00']] })
  assert.equal(leesExifDatum(buf)?.lokaal, '2027-03-08T16:40:00')
})

test('alleen een wijzigingsdatum: die dan maar', () => {
  const buf = jpeg({ ifd0: [[0x0132, '2027:03:10 12:00:00']] })
  assert.equal(leesExifDatum(buf)?.lokaal, '2027-03-10T12:00:00')
})

test('een ander blok (APP0/JFIF) vóór de EXIF wordt overgeslagen', () => {
  const app0 = [0xff, 0xe0, 0, 6, 0x4a, 0x46, 0x49, 0x46]
  const buf = jpeg({ voor: app0, exif: [[0x9003, '2027:03:06 09:00:00']] })
  assert.equal(leesExifDatum(buf)?.lokaal, '2027-03-06T09:00:00')
})

test('lege of onzinnige datum → geen datum', () => {
  assert.equal(leesExifDatum(jpeg({ exif: [[0x9003, '0000:00:00 00:00:00']] })), null)
  assert.equal(leesExifDatum(jpeg({ exif: [[0x9003, 'onbekend']] })), null)
  assert.equal(leesExifDatum(jpeg({ exif: [[0x9003, '2027:03:07 14:32:10'], [0x9011, 'gek']] }))?.offset, null)
})

test('geen EXIF, geen JPEG of afgekapt bestand → null (geen fout)', () => {
  assert.equal(leesExifDatum(jpeg()), null)
  assert.equal(leesExifDatum(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer), null)
  const heel = new Uint8Array(jpeg({ exif: [[0x9003, '2027:03:07 14:32:10']] }))
  for (const n of [3, 10, 20, 40, 60]) assert.doesNotThrow(() => leesExifDatum(heel.slice(0, n).buffer))
})
