import { useCallback, useEffect, useState } from 'react'
import { fetchUserBookings } from '../api/orders'
import { Header } from '../components/Header'
import { BookingsSkeleton } from '../components/skeletons/PageSkeleton'
import { BookingCard } from '../features/bookings/BookingCard'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { useAppSession } from '../hooks/useAppSession'
import { GOTO_HOME_PATH } from '../lib/appContext'
import { normalizeUserBookingsResponse } from '../lib/userBookings'
import { buildSuccessPath } from '../lib/successUrl'
import './BookingsPage.css'

function resolveBookingsUserId(user) {
  return user?.userId || import.meta.env.VITE_ORDER_USER_ID || ''
}

export function BookingsPage() {
  const navigate = useAppNavigate()
  const { user } = useAppSession()
  const userId = resolveBookingsUserId(user)

  const [bookings, setBookings] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  const loadBookings = useCallback(async (signal) => {
    if (!userId) {
      setBookings([])
      setStatus('no-user')
      return
    }

    setStatus('loading')
    setError('')
    try {
      const response = await fetchUserBookings(userId, { signal })
      setBookings(normalizeUserBookingsResponse(response))
      setStatus('ready')
    } catch (err) {
      if (signal?.aborted) return
      setBookings([])
      setError(err?.message || 'Could not load your bookings.')
      setStatus('error')
    }
  }, [userId])

  useEffect(() => {
    const controller = new AbortController()
    loadBookings(controller.signal)
    return () => controller.abort()
  }, [loadBookings])

  const openBooking = useCallback(
    (orderId) => {
      navigate(buildSuccessPath({ orderId, returnTo: '/bookings' }))
    },
    [navigate],
  )

  const goHome = useCallback(() => {
    navigate(GOTO_HOME_PATH, { replace: true })
  }, [navigate])

  if (status === 'loading') {
    return <BookingsSkeleton />
  }

  return (
    <div className="mt-bookings">
      <Header title="Multi Model Bookings" onBack={goHome} />

      <div className="mt-bookings__body">
        {status === 'no-user' ? (
          <p className="mt-bookings__message">
            Open this page with a signed-in user (<code>user_id</code> in the URL) to see your bookings.
          </p>
        ) : null}

        {status === 'error' ? (
          <div className="mt-bookings__message">
            <p>{error}</p>
            <button type="button" className="mt-bookings__retry" onClick={() => loadBookings()}>
              Try again
            </button>
          </div>
        ) : null}

        {status === 'ready' && bookings.length === 0 ? (
          <p className="mt-bookings__message">There are no bookings yet.</p>
        ) : null}

        {status === 'ready' && bookings.length > 0 ? (
          <div className="mt-bookings__list">
            {bookings.map((booking) => (
              <BookingCard
                key={booking.orderId}
                booking={booking}
                onViewDetails={() => openBooking(booking.orderId)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
