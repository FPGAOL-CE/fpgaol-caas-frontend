import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// workaround from https://github.com/vitejs/vite/issues/7015
// https://github.com/vitejs/vite/blob/ec7ee22cf15bed05a6c55693ecbac27cfd615118/packages/vite/src/node/plugins/workerImportMetaUrl.ts#L127-L128
const workerImportMetaUrlRE =
    /\bnew\s+(?:Worker|SharedWorker)\s*\(\s*(new\s+URL\s*\(\s*('[^']+'|"[^"]+"|`[^`]+`)\s*,\s*import\.meta\.url\s*\))/g


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
	  vue(),
	  viteStaticCopy({ targets: [
		  { src: 'public/wasmFPGAloader_lite.js', dest: 'public' },
		  { src: 'public/wasmFPGAloader_lite.wasm', dest: 'public' }
	  ] }) 
  ],
  server: {
    host: 'localhost',
    headers: {
		'Cross-Origin-Embedder-Policy': 'require-corp',
		'Cross-Origin-Opener-Policy': 'same-origin',
	}
  },
  worker: {
  	format: 'es',
  	// https://github.com/vitejs/vite/issues/7015
  	// https://github.com/vitejs/vite/issues/14499#issuecomment-1740267849
  	plugins: () => [
  		{
  			name: 'Disable nested workers',
  			enforce: 'pre',
  			transform(code, id) {
  				if (code.includes('new Worker') && code.includes('new URL') && code.includes('import.meta.url')) {
  					return code.replace(workerImportMetaUrlRE, `((() => { throw new Error('Nested workers are disabled') })()`);
  				}
  			}
  		}
  	]
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  define: { 'process.env': {} }
})
