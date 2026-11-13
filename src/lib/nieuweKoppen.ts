import { config } from '../config'
import { schrijfEnMeld, useOpgeslagen } from './opslag'

/*
 * Schakelaar voor de nieuwe schermkoppen (zie config.nieuweKoppen).
 * In de stand 'test' ziet alleen wie de app één keer opende met #nieuwekop de nieuwe koppen;
 * dat wordt op die telefoon bewaard. Met #oudekop gaat het weer terug.
 */

const SLEUTEL = 'nieuweKoppen.test'

/**
 * Verwerkt #nieuwekop of #oudekop uit het adres. Geeft true als het adres zo'n schakelaar was
 * (dan hoort het niet als tabblad gelezen te worden).
 */
export function verwerkKopSchakelaar(hash: string): boolean {
  if (config.nieuweKoppen !== 'test') return false
  if (hash !== 'nieuwekop' && hash !== 'oudekop') return false
  schrijfEnMeld(SLEUTEL, hash === 'nieuwekop')
  return true
}

/** Moet dit scherm de nieuwe kop tonen? */
export function useNieuweKoppen(): boolean {
  const [test] = useOpgeslagen<boolean>(SLEUTEL, false)
  if (config.nieuweKoppen === 'aan') return true
  return config.nieuweKoppen === 'test' && test
}
