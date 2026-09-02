import './lib/polyfills'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// PWA — ciclo de atualização do service worker.
// O registerSW.js injetado pelo vite-plugin-pwa (injectManifest) só REGISTRA o
// SW: sem este trecho, quem mantém a aba aberta (uso típico do CORH) fica
// preso no build antigo mesmo após um deploy — a SPA nunca recarrega.
// Com skipWaiting()+clientsClaim() no sw.ts, o SW novo assume as abas abertas
// e dispara `controllerchange`: aqui recarregamos UMA vez para a aba receber
// o bundle novo. O setInterval força a checagem de update (o navegador por
// conta própria só procura SW novo a cada ~24h).
if ('serviceWorker' in navigator) {
  let recarregando = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando) return
    recarregando = true
    window.location.reload()
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return
      reg.update()
      setInterval(() => reg.update(), 60 * 60 * 1000)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
