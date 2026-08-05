const blockedMessage = 'O MOVELYA não permite acesso contínuo à câmera ou ao microfone.'

type LegacyMediaNavigator = Navigator & {
  getUserMedia?: (constraints: MediaStreamConstraints, success: (stream: MediaStream) => void, failure: (error: DOMException) => void) => void
  webkitGetUserMedia?: (constraints: MediaStreamConstraints, success: (stream: MediaStream) => void, failure: (error: DOMException) => void) => void
}

function deniedError() {
  return new DOMException(blockedMessage, 'NotAllowedError')
}

function installModernGuard() {
  const devices = navigator.mediaDevices
  if (!devices) return

  const deny = () => Promise.reject(deniedError())

  try {
    Object.defineProperty(devices, 'getUserMedia', {
      configurable: true,
      value: deny,
    })
  } catch {
    // Older Safari versions expose the method only through the prototype.
  }

  const prototype = Object.getPrototypeOf(devices)
  if (!prototype) return

  try {
    Object.defineProperty(prototype, 'getUserMedia', {
      configurable: true,
      value: deny,
    })
  } catch {
    // Permissions-Policy remains the fallback when the browser locks the API.
  }
}

function installLegacyGuards() {
  const legacyNavigator = navigator as LegacyMediaNavigator
  const deny = (_constraints: MediaStreamConstraints, _success: (stream: MediaStream) => void, failure: (error: DOMException) => void) => {
    failure(deniedError())
  }

  for (const method of ['getUserMedia', 'webkitGetUserMedia'] as const) {
    try {
      Object.defineProperty(legacyNavigator, method, {
        configurable: true,
        value: deny,
      })
    } catch {
      // Ignore browsers that do not expose the legacy API.
    }
  }
}

export function installMediaAccessGuard() {
  if (typeof navigator === 'undefined') return
  installModernGuard()
  installLegacyGuards()
}

installMediaAccessGuard()
