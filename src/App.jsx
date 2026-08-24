import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { MobileShell } from './components/MobileShell'
import { captureAppContextFromSearch, withAppContext } from './lib/appContext'
import { demoJourneyPath } from './lib/tripQuery'
import { CabPage } from './pages/CabPage'
import { GoToHomePage } from './pages/GoToHomePage'
import { JourneyDetailPage } from './pages/JourneyDetailPage'
import { JourneyPage } from './pages/JourneyPage'
import { SuccessPage } from './pages/SuccessPage'

/** Keep src / versionName from the entry (or any) URL in sessionStorage. */
function AppContextSync() {
  const location = useLocation()
  useEffect(() => {
    captureAppContextFromSearch(location.search)
  }, [location.search])
  return null
}

export default function App() {
  return (
    <MobileShell>
      <AppContextSync />
      <Routes>
        <Route path="/journey" element={<JourneyPage />} />
        <Route path="/journey-detail" element={<JourneyDetailPage />} />
        <Route path="/cab" element={<CabPage />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/gotohome" element={<GoToHomePage />} />
        <Route path="/" element={<Navigate to={withAppContext(demoJourneyPath())} replace />} />
        <Route path="*" element={<Navigate to={withAppContext(demoJourneyPath())} replace />} />
      </Routes>
    </MobileShell>
  )
}
