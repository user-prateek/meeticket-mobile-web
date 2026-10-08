import { lazy, Suspense, useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AlertHost } from './components/Alert'
import { MobileShell } from './components/MobileShell'
import { BookingsSkeleton, JourneySkeleton } from './components/skeletons/PageSkeleton'
import { captureAppContextFromSearch } from './lib/appContext'
import { persistOlaTokenToBackend, useSaveOlaTokenOnCallback } from './hooks/useOlaUserToken'
import { captureUserFromSearch, persistUserPatch } from './lib/userContext'
import {
  acceptOlaOauthState,
  clearOlaOauthReturn,
  isOlaOauthCallback,
  markOlaOauthPendingSave,
  parseOlaOauthCallback,
  parseOlaOauthFromLocation,
  parseSafeOlaReturnUrl,
  peekOlaOauthReturn,
  rememberOlaOauthResume,
  stripOlaOauthSearch,
} from './lib/olaOauth'
import { storeOlaAccessToken } from './lib/olaToken'
import { sessionStrippedSearch } from './lib/sessionParams'
import { captureJourneyModeFromSearch, demoJourneyPath, hasRequiredTripParams } from './lib/tripQuery'
import {
  clearOlaAuthTestReturn,
  parseOlaAuthTestReturn,
  peekOlaAuthTestMobile,
  peekOlaAuthTestReturn,
} from './lib/olaAuthTest'
import { captureShowCabFromSearch, getShowCab, persistShowCab } from './lib/showCab'
import { appContextAtom, showCabAtom, userAtom } from './store/journey'
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
const MapOpenPage = lazy(() =>
  import('./pages/MapOpenPage').then((m) => ({ default: m.MapOpenPage })),
)
const OlaAuthPage = lazy(() =>
  import('./pages/OlaAuthPage').then((m) => ({ default: m.OlaAuthPage })),
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
  const setShowCab = useSetAtom(showCabAtom)

  useEffect(() => {
    const appContext = captureAppContextFromSearch(location.search)
    setAppContext(appContext)
    captureJourneyModeFromSearch(location.search)
    captureShowCabFromSearch(location.pathname, location.search)

    let storedUser = captureUserFromSearch(location.search)
    const fromHash = parseOlaOauthCallback(location.hash)
    const oauth = parseOlaOauthFromLocation(location)
    const olaCallback = isOlaOauthCallback(location)
    const liveReturn = peekOlaOauthReturn()
    const callbackMobile = liveReturn?.mobile || peekOlaAuthTestMobile()
    if (callbackMobile && !storedUser?.mobile) {
      storedUser = persistUserPatch({ mobile: callbackMobile })
    }
    if (liveReturn?.showCab) persistShowCab(true)
    setShowCab(getShowCab())

    const oauthStyleCallback = Boolean(fromHash || oauth?.expiresIn || oauth?.tokenType)
    const stateAccepted =
      !oauthStyleCallback || acceptOlaOauthState(oauth?.state, oauth?.accessToken)
    if (oauth?.accessToken && !stateAccepted) {
      if (storedUser) setUser(storedUser)
      const cleanedSearch = sessionStrippedSearch(
        stripOlaOauthSearch(location.search.startsWith('?') ? location.search : `?${location.search}`),
      )
      navigate({ pathname: location.pathname, search: cleanedSearch, hash: '' }, { replace: true })
      return
    }

    if (oauth?.accessToken && stateAccepted) {
      storedUser = storeOlaAccessToken(oauth)
      // Hash (and Ola-style query with expires_in) → persist via SET API.
      // Bare ?access_token= from Android is session-only; skip GET/SET.
      if (oauthStyleCallback) {
        markOlaOauthPendingSave()
        persistOlaTokenToBackend()
      }
    }
    if (storedUser) setUser(storedUser)

    if (olaCallback) {
      const bounce = parseSafeOlaReturnUrl(liveReturn?.url)
      if (bounce) {
        if (liveReturn.resume) rememberOlaOauthResume(liveReturn.resume)
        const bouncedSearch = sessionStrippedSearch(stripOlaOauthSearch(bounce.search))
        navigate({ pathname: bounce.pathname, search: bouncedSearch, hash: '' }, { replace: true })
        clearOlaOauthReturn()
        return
      }
    }

    if (location.pathname === '/journey' && !hasRequiredTripParams(location.search)) {
      const saved = peekOlaAuthTestReturn()
      const bounce = parseOlaAuthTestReturn(saved)
      if (bounce) {
        navigate({ pathname: bounce.pathname, search: bounce.search, hash: '' }, { replace: true })
        clearOlaAuthTestReturn()
        return
      }
    }

    const cleanedSearch = sessionStrippedSearch(
      stripOlaOauthSearch(location.search.startsWith('?') ? location.search : `?${location.search}`),
    )
    const currentSearch = location.search.startsWith('?')
      ? location.search.slice(1)
      : location.search
    const hashNeedsClear = Boolean((oauth?.accessToken || olaCallback) && location.hash)

    if (cleanedSearch !== currentSearch || hashNeedsClear) {
      navigate(
        { pathname: location.pathname, search: cleanedSearch, hash: '' },
        { replace: true },
      )
    }
  }, [location.hash, location.pathname, location.search, navigate, setAppContext, setShowCab, setUser])

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
          <Route path="/map-open" element={<MapOpenPage />} />
          <Route path="/ola_auth" element={<OlaAuthPage />} />
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
