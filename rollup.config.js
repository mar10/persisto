import fs from 'fs';
import typescript from '@rollup/plugin-typescript';
import modify from 'rollup-plugin-modify';

let package_json = JSON.parse(fs.readFileSync('package.json', 'utf8'));

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
  plugins: [
    typescript(),
    modify({
      '@VERSION': 'v' + package_json.version,
      '@DATE': '' + new Date().toUTCString(),
      'const default_debuglevel = 2;': 'const default_debuglevel = 1;',
    }),
  ],
};
