import { defineConfig } from 'vite';

// `npm run build`         -> dist/ (multi-file, hashed assets)
// `npm run build:single`  -> dist/index.html with everything inlined (handy for sharing one file)
export default defineConfig(async ({ mode }) => {
  const plugins = [];
  if (mode === 'single') {
    const { viteSingleFile } = await import('vite-plugin-singlefile');
    plugins.push(viteSingleFile());
  }
  return {
    base: './',
    plugins,
    server: { host: '0.0.0.0', port: 3000, allowedHosts: true },
    build: {
      target: 'es2020',
      outDir: 'dist',
      assetsInlineLimit: 4096,
      chunkSizeWarningLimit: 1200,
    },
  };
});
