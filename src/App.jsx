import { Navigate, Route, Routes } from 'react-router-dom'
import { MobileShell } from './components/MobileShell'
import { demoJourneyPath } from './lib/tripQuery'
import { CabPage } from './pages/CabPage'
import { JourneyDetailPage } from './pages/JourneyDetailPage'
import { JourneyPage } from './pages/JourneyPage'
import { SuccessPage } from './pages/SuccessPage'

export default function App() {
  return (
    <MobileShell>
      <Routes>
        <Route path="/journey" element={<JourneyPage />} />
        <Route path="/journey-detail" element={<JourneyDetailPage />} />
        <Route path="/cab" element={<CabPage />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/" element={<Navigate to={demoJourneyPath()} replace />} />
        <Route path="*" element={<Navigate to={demoJourneyPath()} replace />} />
      </Routes>
    </MobileShell>
  )
}
