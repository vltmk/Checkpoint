import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './lib/i18n';
import { ThemeProvider } from 'next-themes';
import { MotionConfig } from 'motion/react';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="checkpoint_theme"
    >
      <LanguageProvider>
        {/* "Reduce motion" in the OS turns every slide and scale into a plain fade */}
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);

