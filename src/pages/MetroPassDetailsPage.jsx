import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { GOTO_HOME_PATH } from '../lib/appContext'
import { METRO_PASS_TERMS, loadMetroPass } from '../lib/metroPass'
import { MetroPassCard, MetroPassChevron, MetroPassHeader } from './MetroPassShared'
import './MetroPass.css'

export function MetroPassDetailsPage() {
  const navigate = useAppNavigate()
  const pass = useMemo(() => loadMetroPass(), [])
  const [showTerms, setShowTerms] = useState(false)

  if (!pass) return <Navigate to="/metro/pass" replace />

  return (
    <section className="mt-metro-pass">
      <MetroPassHeader
        title="Metro Pass Details"
        subtitle={`Mobile No : ${pass.mobile}`}
        onBack={() => navigate('/metro')}
      />

      <div className="mt-metro-pass__form">
        <div className="mt-metro-pass__body mt-metro-pass__body--details">
          <div className="mt-mp-qr">
            <div className="mt-mp-qr__frame">
              <QRCode
                value={pass.passNumber}
                size={188}
                bgColor="#ffffff"
                fgColor="#111111"
                level="M"
              />
            </div>
          </div>

          <div className="mt-metro-pass__details">
            <MetroPassCard pass={pass} />

            <div className="mt-mp-tnc">
              <button
                type="button"
                className="mt-mp-tnc__toggle"
                aria-expanded={showTerms}
                onClick={() => setShowTerms((open) => !open)}
              >
                View Terms &amp; Conditions
                <MetroPassChevron open={showTerms} />
              </button>
              {showTerms ? (
                <ol className="mt-mp-tnc__list">
                  {METRO_PASS_TERMS.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-metro-pass__bar">
          <button
            type="button"
            className="mt-metro-pass__cta"
            onClick={() => navigate(GOTO_HOME_PATH, { replace: true })}
          >
            Go Back Home
          </button>
        </div>
      </div>
    </section>
  )
}
