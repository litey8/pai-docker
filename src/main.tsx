import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { UIHost } from '@/components/ui'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <UIHost />
  </React.StrictMode>,
)
