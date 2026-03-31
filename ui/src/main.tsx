import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import MathJax from 'mathjax';

await MathJax.init({
  loader: { load: ['input/tex', 'output/svg'] }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
