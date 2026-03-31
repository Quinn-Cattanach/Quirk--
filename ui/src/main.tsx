import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import MathJax from 'mathjax';

await MathJax.init({
  loader: { load: ['input/tex', 'output/svg'] } // specify input and output formats
});

const svg = await MathJax.tex2svgPromise('\\frac{1}{x^2-1}', { display: true });
console.log(MathJax.startup.adaptor.serializeXML(svg));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
