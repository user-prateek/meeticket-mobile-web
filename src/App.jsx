import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { MobileShell } from './components/MobileShell'
import { captureAppContextFromSearch, withAppContext } from './lib/appContext'
import { captureUserFromSearch, parseUserQuery } from './lib/userContext'
import { demoJourneyPath } from './lib/tripQuery'
import { userAtom } from './store/journey'
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

/** Keep src / versionName + user profile from the entry (or any) URL in sessionStorage. */
function AppContextSync() {
  const location = useLocation()
  const setUser = useSetAtom(userAtom)

  useEffect(() => {
    captureAppContextFromSearch(location.search)
    const parsed = parseUserQuery(location.search)
    if (parsed) {
      const stored = captureUserFromSearch(location.search)
      setUser(stored)
    }
  }, [location.search, setUser])

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
                <Route path="/success" element={<SuccessPage />} />
                <Route path="/gotohome" element={<GoToHomePage />} />
                <Route path="/" element={<Navigate to={withAppContext(demoJourneyPath())} replace />} />
                <Route path="*" element={<Navigate to={withAppContext(demoJourneyPath())} replace />} />
              </Routes>
            </MobileShell>
          }
        />
      </Routes>
    </>
  )
}
