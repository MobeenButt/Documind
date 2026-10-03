import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import UploadPage     from './pages/UploadPage'
import ProcessingPage from './pages/ProcessingPage'
import ChatPage       from './pages/ChatPage'

// AnimatePresence needs the location key to detect route changes
// So we pull it out into a child component
function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/"           element={<UploadPage />}     />
        <Route path="/processing" element={<ProcessingPage />} />
        <Route path="/chat"       element={<ChatPage />}       />
        {/* Catch-all — any unknown URL goes back to upload */}
        <Route path="*"           element={<UploadPage />}     />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  )
}
