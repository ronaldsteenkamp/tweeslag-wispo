// Tests voor de zip-maker van het jaarboek: `npm test`
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ZipMaker, crc32, veiligeNaam } from '../src/lib/zip.ts'

const bytes = (s) => new TextEncoder().encode(s)

test('crc32 klopt met de bekende waarde', () => {
  assert.equal(crc32(bytes('hello')), 0x3610a686)
  assert.equal(crc32(new Uint8Array()), 0)
})

test('zip heeft de juiste opbouw (kop, centrale lijst, eind)', async () => {
  const z = new ZipMaker()
  z.voegToe('Dag 3 Skidag 1/14-32 Bas - Pistebord.jpg', bytes('foto-een'), new Date(2027, 2, 7, 14, 32, 10))
  z.voegToe('Dag 3 Skidag 1/14-32 Bas - Pistebord.jpg', bytes('foto-twee'))
  z.voegToe('Dag 4 Skidag 2/Crème brûlée ☃.jpg', bytes('drie'))
  const buf = new Uint8Array(await z.blob().arrayBuffer())
  const v = new DataView(buf.buffer)
  assert.equal(v.getUint32(0, true), 0x04034b50)
  const eind = buf.length - 22
  assert.equal(v.getUint32(eind, true), 0x06054b50)
  assert.equal(v.getUint16(eind + 10, true), 3)
  // Namen uit de centrale lijst
  let p = v.getUint32(eind + 16, true)
  const namen = []
  for (let i = 0; i < 3; i++) {
    assert.equal(v.getUint32(p, true), 0x02014b50)
    const n = v.getUint16(p + 28, true)
    namen.push(new TextDecoder().decode(buf.subarray(p + 46, p + 46 + n)))
    p += 46 + n
  }
  assert.deepEqual(namen, ['Dag 3 Skidag 1/14-32 Bas - Pistebord.jpg', 'Dag 3 Skidag 1/14-32 Bas - Pistebord (2).jpg', 'Dag 4 Skidag 2/Crème brûlée ☃.jpg'])
})

test('een echt uitpakprogramma kan hem lezen (tar op Windows/macOS/Linux)', async (t) => {
  const z = new ZipMaker()
  z.voegToe('map/a.txt', bytes('hallo'))
  z.voegToe('b.txt', bytes('wereld'))
  const map = mkdtempSync(join(tmpdir(), 'ziptest-'))
  try {
    const bestand = join(map, 't.zip')
    writeFileSync(bestand, new Uint8Array(await z.blob().arrayBuffer()))
    try {
      execFileSync('tar', ['-xf', bestand, '-C', map])
    } catch {
      t.skip('tar kan hier geen zip uitpakken')
      return
    }
    assert.equal(readFileSync(join(map, 'map', 'a.txt'), 'utf8'), 'hallo')
    assert.equal(readFileSync(join(map, 'b.txt'), 'utf8'), 'wereld')
  } finally {
    rmSync(map, { recursive: true, force: true })
  }
})

test('veilige namen', () => {
  assert.equal(veiligeNaam('Rood is het nieuwe blauw?'), 'Rood is het nieuwe blauw')
  assert.equal(veiligeNaam('a/b\\c:d*e'), 'abcde')
  assert.equal(veiligeNaam('  ...  '), 'foto')
  assert.equal(veiligeNaam('x'.repeat(100)).length, 60)
})
