import { Routes, Route } from 'react-router-dom';
import { InscripcionPage } from './pages/InscripcionPage';
import { PoliticaDatosPage } from './pages/PoliticaDatosPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<InscripcionPage />} />
      <Route path="/politica-datos" element={<PoliticaDatosPage />} />
    </Routes>
  );
}

export default App;
