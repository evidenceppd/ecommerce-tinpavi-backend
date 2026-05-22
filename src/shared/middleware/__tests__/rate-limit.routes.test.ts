import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import express from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'

const rateLimitEnvKeys = [
  'REDIS_URL',
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_AUTH_MAX',
  'RATE_LIMIT_ADMIN_MAX',
  'RATE_LIMIT_PUBLIC_READ_MAX',
  'RATE_LIMIT_USER_MAX',
  'RATE_LIMIT_GENERAL_MAX',
] as const

const originalEnv = Object.fromEntries(
  rateLimitEnvKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof rateLimitEnvKeys)[number], string | undefined>

function applyRateLimitEnv(overrides: Partial<Record<(typeof rateLimitEnvKeys)[number], string>>) {
  for (const key of rateLimitEnvKeys) {
    const value = overrides[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function restoreRateLimitEnv() {
  for (const key of rateLimitEnvKeys) {
    const value = originalEnv[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

async function startRateLimitHarness() {
  vi.resetModules()

  const {
    authRateLimiter,
    adminRateLimiter,
    publicReadRateLimiter,
    userRateLimiter,
  } = await import('../rate-limit')

  const app = express()
  app.set('trust proxy', false)

  app.get('/products', publicReadRateLimiter, (_req, res) => {
    res.status(200).json({ success: true })
  })

  app.post('/auth/login', authRateLimiter, (_req, res) => {
    res.status(200).json({ success: true })
  })

  app.get('/admin/products', adminRateLimiter, (_req, res) => {
    res.status(200).json({ success: true })
  })

  app.get('/me/cart', userRateLimiter, (_req, res) => {
    res.status(200).json({ success: true })
  })

  const server = await new Promise<Server>((resolve) => {
    const activeServer = app.listen(0, () => resolve(activeServer))
  })

  const address = server.address() as AddressInfo
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  }
}

async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

async function requestJson(baseUrl: string, path: string, method: 'GET' | 'POST' = 'GET') {
  const response = await fetch(`${baseUrl}${path}`, { method })

  let body: unknown = null
  const raw = await response.text()
  if (raw) {
    try {
      body = JSON.parse(raw)
    } catch {
      body = raw
    }
  }

  return { response, body }
}

describe('rate-limit route classes', () => {
  afterEach(() => {
    restoreRateLimitEnv()
    vi.resetModules()
  })

  it('keeps public read available under normal volume and blocks auth/admin abuse', async () => {
    applyRateLimitEnv({
      REDIS_URL: '',
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_AUTH_MAX: '2',
      RATE_LIMIT_ADMIN_MAX: '1',
      RATE_LIMIT_PUBLIC_READ_MAX: '4',
      RATE_LIMIT_USER_MAX: '2',
    })

    const { server, baseUrl } = await startRateLimitHarness()

    try {
      const publicResponses = await Promise.all([
        requestJson(baseUrl, '/products'),
        requestJson(baseUrl, '/products'),
        requestJson(baseUrl, '/products'),
      ])

      for (const item of publicResponses) {
        expect(item.response.status).toBe(200)
      }

      await requestJson(baseUrl, '/auth/login', 'POST')
      await requestJson(baseUrl, '/auth/login', 'POST')
      const blockedAuth = await requestJson(baseUrl, '/auth/login', 'POST')

      expect(blockedAuth.response.status).toBe(429)
      expect(blockedAuth.body).toMatchObject({
        error: { code: 'RATE_LIMITED' },
      })

      const hasRateLimitHeader = Boolean(
        blockedAuth.response.headers.get('ratelimit') ||
        blockedAuth.response.headers.get('ratelimit-limit') ||
        blockedAuth.response.headers.get('x-ratelimit-limit'),
      )
      expect(hasRateLimitHeader).toBe(true)

      await requestJson(baseUrl, '/admin/products')
      const blockedAdmin = await requestJson(baseUrl, '/admin/products')

      expect(blockedAdmin.response.status).toBe(429)
      expect(blockedAdmin.body).toMatchObject({
        error: { code: 'RATE_LIMITED' },
      })
    } finally {
      await closeServer(server)
    }
  })

  it('applies user limiter to /me/cart independently from public reads', async () => {
    applyRateLimitEnv({
      REDIS_URL: '',
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_AUTH_MAX: '10',
      RATE_LIMIT_ADMIN_MAX: '10',
      RATE_LIMIT_PUBLIC_READ_MAX: '50',
      RATE_LIMIT_USER_MAX: '2',
    })

    const { server, baseUrl } = await startRateLimitHarness()

    try {
      await requestJson(baseUrl, '/me/cart')
      await requestJson(baseUrl, '/me/cart')
      const blockedCart = await requestJson(baseUrl, '/me/cart')

      expect(blockedCart.response.status).toBe(429)
      expect(blockedCart.body).toMatchObject({
        error: { code: 'RATE_LIMITED' },
      })
    } finally {
      await closeServer(server)
    }
  })
})
