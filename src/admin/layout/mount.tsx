import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from './AdminApp';
import './styles/globals.css';

export function initAdminShell() {
  const container = document.createElement('div');
  document.body.append(container);
  createRoot(container).render(<StrictMode><AdminApp /></StrictMode>);
}
