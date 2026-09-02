import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { MobileShell } from './components/MobileShell'
import { captureAppContextFromSearch } from './lib/appContext'
import { captureUserFromSearch } from './lib/userContext'
import { sessionStrippedSearch } from './lib/sessionParams'
import { demoJourneyPath } from './lib/tripQuery'
import { appContextAtom, userAtom } from './store/journey'
import { BookingsPage } from './pages/BookingsPage'
import { CabPage } from './pages/CabPage'
import { GoToHomePage } from './pages/GoToHomePage'
import { JourneyDetailPage } from './pages/JourneyDetailPage'
import { JourneyPage } from './pages/JourneyPage'
import { PaymentBookingFailedPage } from './pages/PaymentBookingFailedPage'
import { PaymentCallbackPage } from './pages/PaymentCallbackPage'
import { PaymentCheckoutPage } from './pages/PaymentCheckoutPage'
import { PaymentFailedPage } from './pages/PaymentFailedPage'
import { PaymentPage } from './pages/PaymentPage'
import { SuccessPage } from './pages/SuccessPage'

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
      <Routes>
        {/* Bare pages for Paytm checkout / callback (no mobile chrome). */}
        <Route path="/payment/checkout" element={<PaymentCheckoutPage />} />
        <Route path="/payment/callback" element={<PaymentCallbackPage />} />
        <Route
          path="*"
          element={
            <MobileShell>
              <Routes>
                <Route path="/journey" element={<JourneyPage />} />
                <Route path="/journey-detail" element={<JourneyDetailPage />} />
                <Route path="/payment" element={<PaymentPage />} />
                <Route path="/payment/failed" element={<PaymentFailedPage />} />
                <Route path="/payment/booking-failed" element={<PaymentBookingFailedPage />} />
                <Route path="/cab" element={<CabPage />} />
                <Route path="/bookings" element={<BookingsPage />} />
                <Route path="/success" element={<SuccessPage />} />
                <Route path="/gotohome" element={<GoToHomePage />} />
                <Route path="/" element={<Navigate to={demoJourneyPath()} replace />} />
                <Route path="*" element={<Navigate to={demoJourneyPath()} replace />} />
              </Routes>
            </MobileShell>
          }
        />
      </Routes>
    </>
  )
}
