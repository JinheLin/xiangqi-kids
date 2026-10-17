import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './touch.css';
import './app-shell.css';
import './guided.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
