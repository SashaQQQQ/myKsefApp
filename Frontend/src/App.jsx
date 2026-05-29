import { useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import "./Styles/App.css";
import Home from "./Components/Home.jsx";
import Result from "./Components/Result.jsx";
function App() {
  return (
    <div className="app">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/result" element={<Result />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
