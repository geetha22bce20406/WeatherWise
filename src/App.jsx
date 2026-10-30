import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./context";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Space from "./pages/Space";
import Intelligence from "./pages/Intelligence";

function App() {
  return (
    <AppProvider>
      <div className="sky" aria-hidden="true">
        <i className="orb o1" />
        <i className="orb o2" />
        <i className="orb o3" />
        <i className="rain-layer" />
      </div>

      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/intelligence" element={<Intelligence />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/space" element={<Space />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;