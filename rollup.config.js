import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/persisto.ts',
  output: [
    {
      file: 'dist/persisto.esm.js',
      format: 'es',
    },
    {
      file: 'dist/persisto.umd.js',
      format: 'umd',
      name: 'mar10',
    },
  ],
  plugins: [typescript()],
};
