import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import TableView from './pages/TableView'
import PlayerView from './pages/PlayerView'
import AdminPage from './pages/AdminPage'
import ReplayView from './pages/ReplayView'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/table/:roomCode" element={<TableView />} />
        <Route path="/player/:roomCode" element={<PlayerView />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/replay/:gameId" element={<ReplayView />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
