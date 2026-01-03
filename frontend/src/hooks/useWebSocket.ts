import { BACKEND_LOCAL_PORT } from '@holdem/shared/config'

export function buildWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const isDevelopment =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  return isDevelopment
    ? `${protocol}//localhost:${BACKEND_LOCAL_PORT}/ws`
    : `${protocol}//${window.location.host}/ws`
}
