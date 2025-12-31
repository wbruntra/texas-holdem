import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import TableView from './pages/TableView';
import PlayerView from './pages/PlayerView';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/table/:roomCode" element={<TableView />} />
        <Route path="/player/:roomCode" element={<PlayerView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
