import { lazy, Suspense, useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AlertHost } from './components/Alert'
import { MobileShell } from './components/MobileShell'
import { BookingsSkeleton, JourneySkeleton } from './components/skeletons/PageSkeleton'
import { captureAppContextFromSearch } from './lib/appContext'
import { useSaveOlaTokenOnCallback } from './hooks/useOlaUserToken'
import { captureUserFromSearch } from './lib/userContext'
import {
  markOlaOauthPendingSave,
  parseOlaOauthCallback,
  peekOlaOauthState,
  stripOlaOauthSearch,
} from './lib/olaOauth'
import { storeOlaAccessToken } from './lib/olaToken'
import { sessionStrippedSearch } from './lib/sessionParams'
import { demoJourneyPath } from './lib/tripQuery'
import { appContextAtom, userAtom } from './store/journey'
import { BookingsPage } from './pages/BookingsPage'
import { JourneyPage } from './pages/JourneyPage'

/** Non-entry screens — deferred so WebView FCP stays on journey/bookings. */
const CabPage = lazy(() => import('./pages/CabPage').then((m) => ({ default: m.CabPage })))
const RidePage = lazy(() => import('./pages/RidePage').then((m) => ({ default: m.RidePage })))
const GoToHomePage = lazy(() =>
  import('./pages/GoToHomePage').then((m) => ({ default: m.GoToHomePage })),
)
const JourneyDetailPage = lazy(() =>
  import('./pages/JourneyDetailPage').then((m) => ({ default: m.JourneyDetailPage })),
)
const PaymentBookingFailedPage = lazy(() =>
  import('./pages/PaymentBookingFailedPage').then((m) => ({
    default: m.PaymentBookingFailedPage,
  })),
)
const PaymentCallbackPage = lazy(() =>
  import('./pages/PaymentCallbackPage').then((m) => ({ default: m.PaymentCallbackPage })),
)
const PaymentCheckoutPage = lazy(() =>
  import('./pages/PaymentCheckoutPage').then((m) => ({ default: m.PaymentCheckoutPage })),
)
const PaymentFailedPage = lazy(() =>
  import('./pages/PaymentFailedPage').then((m) => ({ default: m.PaymentFailedPage })),
)
const PaymentPage = lazy(() =>
  import('./pages/PaymentPage').then((m) => ({ default: m.PaymentPage })),
)
const SuccessPage = lazy(() =>
  import('./pages/SuccessPage').then((m) => ({ default: m.SuccessPage })),
)
const LiveTrackingPage = lazy(() =>
  import('./features/tracking/LiveTrackingPage').then((m) => ({ default: m.LiveTrackingPage })),
)

function RouteFallback() {
  const path = useLocation().pathname
  if (path.startsWith('/bookings')) return <BookingsSkeleton />
  if (path.startsWith('/ride')) {
    return (
      <div
        style={{ minHeight: '100dvh', background: '#f1f1f1' }}
        role="status"
        aria-label="Loading"
      />
    )
  }
  if (path.startsWith('/cab')) {
    return (
      <div className="mt-success-loading" role="status">
        <p>Loading cab options…</p>
      </div>
    )
  }
  if (path.startsWith('/payment')) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: '#f0f1f3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
          fontSize: 14,
          fontWeight: 600,
        }}
        role="status"
      >
        Preparing payment…
      </div>
    )
  }
  return <JourneySkeleton />
}

/** Capture WebView credentials from URL into session state; strip them from the address bar. */
function AppContextSync() {
  const location = useLocation()
  const navigate = useNavigate()
  const setUser = useSetAtom(userAtom)
  const setAppContext = useSetAtom(appContextAtom)

  useEffect(() => {
    const appContext = captureAppContextFromSearch(location.search)
    setAppContext(appContext)

    let storedUser = captureUserFromSearch(location.search)
    const fromHash = parseOlaOauthCallback(location.hash)
    const fromSearch = parseOlaOauthCallback(location.search)
    const oauth = fromHash || fromSearch
    if (oauth?.accessToken) {
      const expected = peekOlaOauthState()
      const stateOk = !oauth.state || !expected || oauth.state === expected
      if (stateOk) {
        storedUser = storeOlaAccessToken(oauth)
        // Hash (and Ola-style query with expires_in) → persist via SET API.
        // Bare ?access_token= from Android is session-only; skip GET/SET.
        if (fromHash || oauth.expiresIn || oauth.tokenType) {
          markOlaOauthPendingSave()
        }
      }
    }
    if (storedUser) setUser(storedUser)

    const cleanedSearch = sessionStrippedSearch(
      stripOlaOauthSearch(location.search.startsWith('?') ? location.search : `?${location.search}`),
    )
    const currentSearch = location.search.startsWith('?')
      ? location.search.slice(1)
      : location.search
    const hashNeedsClear = Boolean(oauth?.accessToken && location.hash)

    if (cleanedSearch !== currentSearch || hashNeedsClear) {
      navigate(
        { pathname: location.pathname, search: cleanedSearch, hash: '' },
        { replace: true },
      )
    }
  }, [location.hash, location.pathname, location.search, navigate, setAppContext, setUser])

  return null
}

function OlaTokenCallbackSync() {
  useSaveOlaTokenOnCallback()
  return null
}

export default function App() {
  return (
    <>
      <AppContextSync />
      <OlaTokenCallbackSync />
      <AlertHost />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Bare pages for Paytm checkout / callback (no mobile chrome). */}
          <Route path="/payment/checkout" element={<PaymentCheckoutPage />} />
          <Route path="/payment/callback" element={<PaymentCallbackPage />} />
          <Route
            path="*"
            element={
              <MobileShell>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/journey" element={<JourneyPage />} />
                    <Route path="/journey-detail" element={<JourneyDetailPage />} />
                    <Route path="/payment" element={<PaymentPage />} />
                    <Route path="/payment/failed" element={<PaymentFailedPage />} />
                    <Route path="/payment/booking-failed" element={<PaymentBookingFailedPage />} />
                    <Route path="/ride" element={<RidePage />} />
                    <Route path="/cab" element={<CabPage />} />
                    <Route path="/live-tracking" element={<LiveTrackingPage />} />
                    <Route path="/bookings" element={<BookingsPage />} />
                    <Route path="/success" element={<SuccessPage />} />
                    <Route path="/gotohome" element={<GoToHomePage />} />
                    <Route path="/" element={<Navigate to={demoJourneyPath()} replace />} />
                    <Route path="*" element={<Navigate to={demoJourneyPath()} replace />} />
                  </Routes>
                </Suspense>
              </MobileShell>
            }
          />
        </Routes>
      </Suspense>
    </>
  )
}
