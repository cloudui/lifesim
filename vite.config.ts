import { defineConfig } from 'vite';

// Relative asset paths, so the same build works at username.github.io/<repo>/
// and at the root of a custom domain.
export default defineConfig({
  base: './',
});
