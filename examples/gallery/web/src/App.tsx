import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Landing } from './scenes/Landing';
import { PrivacyXray } from './scenes/PrivacyXray';
import { Assistant } from './scenes/Assistant';
import { Dashboard } from './scenes/Dashboard';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/privacy" element={<PrivacyXray />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Landing />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
