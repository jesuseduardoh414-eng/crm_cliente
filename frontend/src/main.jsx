import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BRAND_NAME } from './config/brand'

// El <title> de index.html es el que se ve mientras carga el bundle; aqui se
// completa con el nombre de marca para no tener que mantenerlo en dos sitios.
document.title = `${BRAND_NAME} · Panel Interno`

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
