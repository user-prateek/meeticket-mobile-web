import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { withAppContext } from '../lib/appContext'

/** navigate() that always keeps `src` + `versionName` on the URL. */
export function useAppNavigate() {
  const navigate = useNavigate()
  return useCallback(
    (to, options) => {
      if (typeof to === 'string') {
        navigate(withAppContext(to), options)
        return
      }
      navigate(to, options)
    },
    [navigate],
  )
}
