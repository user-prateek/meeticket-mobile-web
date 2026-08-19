import { Header } from '../../components/Header'
import type { RouteOption } from '../../types/route'
import { RouteCard } from './RouteCard'
import './SrpPage.css'

export type SrpPageProps = {
  routeList: RouteOption[]
  onSelectRoute: (route: RouteOption) => void
  onBack?: () => void
  onChooseMultiModal?: () => void
  title?: string
}

/**
 * Search results page. One card per item in `routeList`.
 */
export function SrpPage({
  routeList,
  onSelectRoute,
  onBack,
  onChooseMultiModal,
  title = 'Journey Options',
}: SrpPageProps) {
  const routes = routeList
  const count = routes.length
  const subtitle = `${count} Route${count === 1 ? '' : 's'} Found`

  return (
    <section className="mt-srp">
      <Header title={title} subtitle={subtitle} onBack={onBack} />

      <div className="mt-srp__list">
        {count === 0 ? (
          <p className="mt-srp__empty">No routes found.</p>
        ) : (
          routes.map((route) => (
            <RouteCard key={route.id} route={route} onSelect={onSelectRoute} />
          ))
        )}
      </div>

      <div className="mt-srp__footer">
        <button type="button" className="mt-srp__cta" onClick={onChooseMultiModal}>
          Choose Multi Model
        </button>
      </div>
    </section>
  )
}
