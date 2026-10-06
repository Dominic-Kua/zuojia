import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { StoryMapApp } from './components/StoryMap/StoryMapApp'
import './styles.css'

const params = new URLSearchParams(window.location.search)
const view = params.get('view')

const root = createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    {view === 'storymap' ? <StoryMapApp /> : <App />}
  </React.StrictMode>
)
