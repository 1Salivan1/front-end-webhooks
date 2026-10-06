import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

/**
 * The mock *is* the backend for this app, so the worker starts in production
 * builds too — not only in development — and before the first render, so no
 * request can slip past it.
 */
async function startMockApi(): Promise<void> {
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

async function bootstrap(): Promise<void> {
  await startMockApi()

  const container = document.getElementById('root')
  if (container === null) throw new Error('Root container is missing.')

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
