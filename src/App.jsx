import { lazy, Suspense, useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { MobileShell } from './components/MobileShell'
import { BookingsSkeleton, JourneySkeleton } from './components/skeletons/PageSkeleton'
import { captureAppContextFromSearch } from './lib/appContext'
import { captureUserFromSearch } from './lib/userContext'
import { sessionStrippedSearch } from './lib/sessionParams'
import { demoJourneyPath } from './lib/tripQuery'
import { appContextAtom, userAtom } from './store/journey'
import { BookingsPage } from './pages/BookingsPage'
import { JourneyPage } from './pages/JourneyPage'

/** Non-entry screens — deferred so WebView FCP stays on journey/bookings. */
const CabPage = lazy(() => import('./pages/CabPage').then((m) => ({ default: m.CabPage })))
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

    const storedUser = captureUserFromSearch(location.search)
    if (storedUser) setUser(storedUser)

    const cleanedSearch = sessionStrippedSearch(location.search)
    const currentSearch = location.search.startsWith('?')
      ? location.search.slice(1)
      : location.search

    if (cleanedSearch !== currentSearch) {
      navigate({ pathname: location.pathname, search: cleanedSearch }, { replace: true })
    }
  }, [location.pathname, location.search, navigate, setAppContext, setUser])

  return null
}

export default function App() {
  return (
    <>
      <AppContextSync />
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
