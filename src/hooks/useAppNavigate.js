import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/** In-app navigation — session credentials stay in storage, not on the URL. */
export function useAppNavigate() {
  const navigate = useNavigate()
  return useCallback(
    (to, options) => {
      navigate(to, options)
    },
    [navigate],
  )
}
