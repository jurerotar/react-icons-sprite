import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { reactIconsSprite } from 'react-icons-sprite/vite';

export default defineConfig({
  plugins: [react(), reactIconsSprite()],
  server: {
    open: true,
  },
});
