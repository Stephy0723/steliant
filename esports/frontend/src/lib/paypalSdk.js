// Carga perezosa del SDK de botones de PayPal (Smart Payment Buttons). Se
// carga una sola vez por clientId -- si cambia el clientId (raro, solo pasa
// si cambias de cuenta) se reemplaza el script.
let sdkPromise = null
let loadedClientId = null

export function loadPayPalSdk(clientId, currency = 'USD') {
  if (!clientId) return Promise.reject(new Error('Falta el Client ID de PayPal.'))
  if (sdkPromise && loadedClientId === clientId) return sdkPromise

  loadedClientId = clientId
  sdkPromise = new Promise((resolve, reject) => {
    document.getElementById('gg-paypal-sdk')?.remove()
    const script = document.createElement('script')
    script.id = 'gg-paypal-sdk'
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${currency}&intent=capture&components=buttons`
    script.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error('PayPal no se inicializó.')))
    script.onerror = () => reject(new Error('No se pudo cargar el SDK de PayPal.'))
    document.body.appendChild(script)
  })
  return sdkPromise
}

