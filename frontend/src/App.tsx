import { useEffect, useState } from 'react'
import axios from 'axios'
import './App.css'

function App() {
  const [backendMessage, setBackendMessage] = useState('')

  useEffect(() => {
    axios
      .get('/api/hello')
      .then((response) => {
        setBackendMessage(response.data.message)
      })
      .catch((error) => {
        console.error('Error fetching backend message:', error)
      })
  })

  return (
    <>
      <div className="container"></div>
      <h1>Vite + React</h1>
      <div className="card">
        <p>Backend says: {backendMessage}</p>
      </div>
    </>
  )
}

export default App
