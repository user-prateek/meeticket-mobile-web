import { lazy, Suspense, useEffect, useLayoutEffect } from 'react'
import { useSetAtom } from 'jotai'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AlertHost } from './components/Alert'
import { MobileShell } from './components/MobileShell'
import { BookingsSkeleton, JourneySkeleton } from './components/skeletons/PageSkeleton'
import { captureAppContextFromSearch } from './lib/appContext'
import { completeOlaOauthReturn, saveOlaUserToken } from './hooks/useOlaUserToken'
import { captureUserFromSearch, persistUserPatch } from './lib/userContext'
import {
  captureOlaCallbackUrl,
  clearBootOlaCallback,
  olaCallbackHref,
  parseOlaOauthCallback,
  peekOlaOauthReturn,
  readOlaHashCallback,
  stripOlaOauthSearch,
} from './lib/olaOauth'
import { sessionStrippedSearch } from './lib/sessionParams'
import { captureJourneyModeFromSearch, demoJourneyPath, hasRequiredTripParams } from './lib/tripQuery'
import {
  clearOlaAuthTestReturn,
  parseOlaAuthTestReturn,
  peekOlaAuthTestMobile,
  peekOlaAuthTestReturn,
} from './lib/olaAuthTest'
import { captureShowCabFromSearch, getShowCab, persistShowCab } from './lib/showCab'
import { showAlertAtom } from './store/alert'
import { appContextAtom, olaAccessTokenAtom, showCabAtom, userAtom } from './store/journey'
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

function olaUserTokenFromSearch(search = '') {
  const raw = String(search || '')
  const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw)
  return String(params.get('ola_access_token') || params.get('access_token') || '').trim()
}

/** Capture WebView credentials from URL into session state; strip them from the address bar. */
function AppContextSync() {
  const location = useLocation()
  const navigate = useNavigate()
  const setUser = useSetAtom(userAtom)
  const setAppContext = useSetAtom(appContextAtom)
  const setShowCab = useSetAtom(showCabAtom)
  const setOlaAccessToken = useSetAtom(olaAccessTokenAtom)
  const showAlert = useSetAtom(showAlertAtom)

  useLayoutEffect(() => {
    if (parseOlaOauthCallback(location.hash)?.accessToken) return
    const token = olaUserTokenFromSearch(location.search)
    if (!token) return
    const params = new URLSearchParams(
      location.search.startsWith('?') ? location.search.slice(1) : location.search,
    )
    const expiresIn = Number(params.get('expires_in'))
    const expiresAt =
      Number.isFinite(expiresIn) && expiresIn > 0 ? Date.now() + expiresIn * 1000 : null
    const storedUser = saveOlaUserToken(token, {
      expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : null,
      expiresAt,
    })
    setOlaAccessToken({
      accessToken: token,
      expiresIn: storedUser?.olaExpiresIn ?? null,
      expiresAt: storedUser?.olaTokenExpiresAt ?? null,
    })
    setUser(storedUser)
  }, [location.hash, location.search, setOlaAccessToken, setUser])

  useEffect(() => {
    const appContext = captureAppContextFromSearch(location.search)
    setAppContext(appContext)
    captureJourneyModeFromSearch(location.search)
    captureShowCabFromSearch(location.pathname, location.search)

    let storedUser = captureUserFromSearch(location.search)
    const hashCallback = readOlaHashCallback(location)
    const liveReturn = peekOlaOauthReturn()
    const callbackMobile = liveReturn?.mobile || peekOlaAuthTestMobile()
    if (callbackMobile && !storedUser?.mobile) {
      storedUser = persistUserPatch({ mobile: callbackMobile })
    }
    if (liveReturn?.showCab) persistShowCab(true)
    setShowCab(getShowCab())
    if (storedUser) setUser(storedUser)

    if (hashCallback.isCallback) {
      captureOlaCallbackUrl(olaCallbackHref() || window.location.href)
      if (!hashCallback.parsed?.accessToken) {
        clearBootOlaCallback()
        showAlert({ msg: 'Ola did not return an access token.', error: true })
        return undefined
      }
      let cancelled = false
      completeOlaOauthReturn(hashCallback.parsed)
        .then((target) => {
          if (cancelled || !target?.pathname) return
          clearBootOlaCallback()
          navigate(
            { pathname: target.pathname, search: target.search, hash: target.hash || '' },
            { replace: true },
          )
        })
        .catch((error) => {
          if (cancelled) return
          clearBootOlaCallback()
          showAlert({
            msg: error?.message || 'Could not save the Ola token.',
            error: true,
          })
        })
      return () => {
        cancelled = true
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
    const hashNeedsClear = Boolean(hashCallback.isCallback && location.hash)

    if (cleanedSearch !== currentSearch || hashNeedsClear) {
      navigate(
        { pathname: location.pathname, search: cleanedSearch, hash: '' },
        { replace: true },
      )
    }
  }, [location.hash, location.pathname, location.search, navigate, setAppContext, setShowCab, setUser, showAlert])

  return null
}

/** Keep a hash callback on `/` from being replaced before it is read. Ola's callback is `/journey#access_token=…`. */
function HomeRoute() {
  const location = useLocation()
  if (readOlaHashCallback(location).isCallback) return <RouteFallback />
  return <Navigate to={demoJourneyPath()} replace />
}

export default function App() {
  return (
    <>
      <AppContextSync />
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
                    <Route path="/" element={<HomeRoute />} />
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
