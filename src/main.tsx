import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { installRecueilValidationUx } from './portal/recueilValidationUx';
import './index.css';
import './patrimony-dark.css';
import './documents-contrast-fix.css';
import './cabinet-dark.css';
import './recueil-validation.css';

installRecueilValidationUx();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
