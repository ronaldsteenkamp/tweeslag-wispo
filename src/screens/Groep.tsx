import { Segmenten } from '../components/Segmenten'
import { useOpgeslagen } from '../lib/opslag'
import Fotomuur from './Fotomuur'
import Kamers from './Kamers'

export type GroepOnderdeel = 'kamers' | 'clubblad'

/**
 * Groep: de appartementen (met iedereens plaatje) en het clubblad, met de keuze in de kop.
 * Na de reis staat het clubblad ook als eigen tab in de balk.
 */
export default function Groep({ naarVerdelen, naarBeheer }: { naarVerdelen: () => void; naarBeheer: () => void }) {
  const [onderdeel, setOnderdeel] = useOpgeslagen<GroepOnderdeel>('groep.onderdeel', 'kamers')
  const keuze = (
    <Segmenten
      label="Onderdeel"
      opties={[
        ['kamers', 'Appartementen'],
        ['clubblad', 'Clubblad'],
      ]}
      waarde={onderdeel}
      kies={(w) => {
        setOnderdeel(w)
        window.scrollTo(0, 0)
      }}
    />
  )
  return onderdeel === 'clubblad' ? (
    <Fotomuur keuze={keuze} naarSpel={() => (window.location.hash = '#spel')} />
  ) : (
    <Kamers keuze={keuze} naarVerdelen={naarVerdelen} naarBeheer={naarBeheer} />
  )
}
