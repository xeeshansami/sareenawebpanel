import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CostUnlockProvider } from './context/CostUnlockContext.jsx';
import { ConsumerProvider } from './context/ConsumerContext.jsx';
import './index.css';

// HashRouter keeps deep links working on GitHub Pages (no server rewrites needed).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      {/* Both sessions can be live at once — a shopkeeper browsing their own
          storefront — and neither provider knows about the other. */}
      <ConsumerProvider>
        <AuthProvider>
          <CostUnlockProvider>
            <App />
          </CostUnlockProvider>
        </AuthProvider>
      </ConsumerProvider>
    </HashRouter>
  </React.StrictMode>
);
