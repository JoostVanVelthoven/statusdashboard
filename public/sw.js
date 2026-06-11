const CACHE_NAME = 'status-dashboard-v3'
const INDEX_URL = '/index.html'
const APP_SHELL = [INDEX_URL, '/manifest.webmanifest', '/favicon.svg', '/icons.svg']
const HASHED_ASSET_PATTERN = /^\/assets\/.*-[A-Za-z0-9_-]+\.(?:css|js)$/
const MESSAGE_PAGE_RELOAD = 'PAGE_RELOAD_REQUIRED'
const MESSAGE_RELEASE_RELOAD = 'RELEASE_HARD_RELOAD_REQUIRED'

let releaseRecoveryPromise

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

async function getWindowClients() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
}

async function broadcastMessage(type) {
  const clients = await getWindowClients()
  clients.forEach((client) => client.postMessage({ type }))
}

async function reloadWindowClients(type) {
  const clients = await getWindowClients()

  await Promise.allSettled(
    clients.map((client) => {
      client.postMessage({ type })
      return client.navigate(client.url)
    }),
  )
}

async function fetchLatestIndex({ notifyOnEtagChange }) {
  const cache = await caches.open(CACHE_NAME)
  const cachedIndex = await cache.match(INDEX_URL)
  const response = await fetch(INDEX_URL, { cache: 'no-cache' })

  if (!response.ok) return response

  const previousEtag = cachedIndex?.headers.get('etag')
  const nextEtag = response.headers.get('etag')
  await cache.put(INDEX_URL, response.clone())

  if (notifyOnEtagChange && previousEtag && nextEtag && previousEtag !== nextEtag) {
    await broadcastMessage(MESSAGE_PAGE_RELOAD)
  }

  return response
}

async function serveNavigation(event) {
  const cache = await caches.open(CACHE_NAME)
  const cachedIndex = await cache.match(INDEX_URL)

  if (cachedIndex) {
    event.waitUntil(fetchLatestIndex({ notifyOnEtagChange: true }).catch(() => undefined))
    return cachedIndex
  }

  try {
    return await fetchLatestIndex({ notifyOnEtagChange: false })
  } catch {
    return Response.error()
  }
}

async function recoverFromMissingReleaseAsset() {
  if (!releaseRecoveryPromise) {
    releaseRecoveryPromise = (async () => {
      const response = await fetchLatestIndex({ notifyOnEtagChange: false })
      if (response.ok) {
        await reloadWindowClients(MESSAGE_RELEASE_RELOAD)
      }
    })().finally(() => {
      releaseRecoveryPromise = undefined
    })
  }

  return releaseRecoveryPromise
}

async function serveHashedAsset(event) {
  const cached = await caches.match(event.request)
  if (cached) return cached

  const response = await fetch(event.request)
  if (response.status === 404) {
    event.waitUntil(recoverFromMissingReleaseAsset())
    return response
  }

  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(event.request, response.clone())
  }

  return response
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  if (event.request.mode === 'navigate') {
    event.respondWith(serveNavigation(event))
    return
  }

  if (HASHED_ASSET_PATTERN.test(url.pathname)) {
    event.respondWith(serveHashedAsset(event))
  }
})
