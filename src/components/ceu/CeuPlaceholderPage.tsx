import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { CeuPage } from './CeuPage'

interface CeuPlaceholderPageProps {
  titulo: string
  descricao: string
}

export function CeuPlaceholderPage({ titulo, descricao }: CeuPlaceholderPageProps) {
  return (
    <CeuPage>
      <PlaceholderPage titulo={titulo} descricao={descricao} />
    </CeuPage>
  )
}
