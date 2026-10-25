import { build, context } from 'esbuild';

const options = {
  entryPoints: ['src/main.jsx'],
  bundle: true,
  outfile: 'dist/app.js',
  loader: { '.jsx': 'jsx' },
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
  logLevel: 'info'
};

if (process.argv.includes('--watch')) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('watching src/ ...');
} else {
  await build(options);
}
