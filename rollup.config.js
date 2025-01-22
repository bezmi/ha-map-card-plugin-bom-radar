import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import postcss from 'rollup-plugin-postcss';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/bom-plugin.js',
    format: 'esm',
  },
  plugins: [
    nodeResolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
    }),
    postcss({
      // we inject the styles manually into the shadow DOM
      inject: false,
    }),
    json(),
  ],
  external: ['leaflet'],//  Leaflet is available in the runtime environment
};
