import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { MobileShell } from './components/MobileShell'
import { getRouteById, getRouteList, SEARCH_DEFAULTS } from './constants/journey'
import { SrpPage } from './features/srp'
import type { RouteOption, SearchQuery, TripMode } from './types/route'
import { RouteDetailsPage } from './pages/RouteDetailsPage'
import { SearchPage } from './pages/SearchPage'

type SrpState = {
  tripMode?: TripMode
}

type DetailsState = {
  route?: RouteOption
}

function filterRoutes(tripMode?: TripMode): RouteOption[] {
  const routes = getRouteList()
  if (tripMode !== 'single') return routes
  return routes.filter(
    (route) => route.segments.length === 1 && route.segments[0]?.mode !== 'walk',
  )
}

function SrpRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const tripMode = (location.state as SrpState | null)?.tripMode
  const routeList = filterRoutes(tripMode)

  function openRoute(route: RouteOption) {
    navigate(`/srp/${route.id}`, { state: { route } })
  }

  function chooseMultiModal() {
    const multiModal = routeList.find((route) => route.segments.length > 1)
    if (multiModal) openRoute(multiModal)
  }

  return (
    <SrpPage
      routeList={routeList}
      onSelectRoute={openRoute}
      onBack={() => navigate('/')}
      onChooseMultiModal={chooseMultiModal}
    />
  )
}

function SearchRoute() {
  const navigate = useNavigate()

  function handleSearch(query: SearchQuery) {
    navigate('/srp', { state: { tripMode: query.mode } })
  }

  return (
    <SearchPage
      fromPlace={SEARCH_DEFAULTS.fromPlace}
      toPlace={SEARCH_DEFAULTS.toPlace}
      mode={SEARCH_DEFAULTS.mode}
      onBack={() => navigate(-1)}
      onSearch={handleSearch}
    />
  )
}

function DetailsRoute() {
  const { routeId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const stateRoute = (location.state as DetailsState | null)?.route
  const route = stateRoute ?? (routeId ? getRouteById(routeId) : undefined)

  return (
    <RouteDetailsPage
      route={route}
      onBack={() => navigate('/srp')}
      onConfirm={() => navigate('/')}
    />
  )
}

export default function App() {
  return (
    <MobileShell>
      <Routes>
        <Route path="/" element={<SearchRoute />} />
        <Route path="/srp" element={<SrpRoute />} />
        <Route path="/srp/:routeId" element={<DetailsRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MobileShell>
  )
}
