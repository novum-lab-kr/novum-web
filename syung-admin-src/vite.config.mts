// 슝 관리 화면 빌드 — src/ → ../syung-admin/admin/(커밋한다). 서버(deploy/site.sh)는 빌드하지 않고 syung-admin/ 을 그대로 복사하므로
// 빌드 결과를 레포에 싣고, deploy/check-syung-admin.mjs 가 원본으로 다시 빌드해 같은지 본다(다르면 배포가 멈춘다).
//   npm ci && npm run build      # 원본을 고친 뒤 결과까지 함께 커밋
// 슝 레포 vite.config.mts 의 관리 화면 부분을 옮겨 왔다(2026-10-30) — 같은 원칙:
// - 모듈 하나 = 파일 하나(preserveModules) · 이름 그대로(.tsx · .mts → .mjs) — 묶지 않는다 · 줄이기(minify) 안 함
// - HTML · vendor/(uPlot) 는 손대지 않고 그대로 복사
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

const root = path.join(import.meta.dirname, 'src')
const vendor = path.join(root, 'vendor')
// 레포의 서비스 폴더 syung-admin/ 아래 admin/ — 서버 폴더에서도 /admin/… 주소 모양 그대로
const outDir = process.env.SYUNG_ADMIN_OUT ?? path.join(import.meta.dirname, '..', 'syung-admin', 'admin')
// 빌드가 만드는 코드(그대로 복사하지 않는다)
const CODE = /\.(mjs|mts|ts|tsx)$/
// 화면마다 HTML 의 <script type="module" src="./<이름>.mjs"> 가 부르는 모듈
const PAGES = ['status', 'members', 'debug', 'learning']

// 모듈이 아닌 파일(HTML · vendor/ 전부)을 결과 폴더의 같은 자리로 그대로 복사한다
function staticFiles(dir: string = root): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue   // .DS_Store
    const from = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...staticFiles(from))
    else if (from.startsWith(vendor + path.sep) || !CODE.test(entry.name)) files.push(from)
  }
  return files
}

function copyStatic(): Plugin {
  return {
    name: 'syung-admin-copy-static',
    apply: 'build',
    closeBundle() {
      for (const from of staticFiles()) {
        const to = path.join(outDir, path.relative(root, from))
        fs.mkdirSync(path.dirname(to), { recursive: true })
        fs.copyFileSync(from, to)
      }
    },
  }
}

// 결과 파일 이름: src/ 밖(node_modules/<패키지>/…)에서 온 모듈은 npm/<패키지>/… 로
// (node_modules 가 링크면 이름 앞에 실제 경로가 붙는다 — 마지막 node_modules/ 뒤만 본다)
const npmPath = (name: string) => name.replace(/^(?:.*\/)?node_modules\//, 'npm/')

export default defineConfig({
  root,
  base: './',
  publicDir: false,
  plugins: [copyStatic()],
  // 화면 조각(.tsx — Preact): JSX 는 preact/jsx-runtime 으로(tsconfig 의 jsxImportSource 와 같다)
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  build: {
    outDir,
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    modulePreload: false,
    reportCompressedSize: false,
    rollupOptions: {
      input: Object.fromEntries(PAGES.map(name => [name, path.join(root, `${name}.tsx`)])),
      preserveEntrySignatures: 'strict',
      treeshake: false,
      output: {
        format: 'es',
        preserveModules: true,
        preserveModulesRoot: root,
        // npm 패키지(preact)는 node_modules/… 대신 npm/… 로 낸다 — 운영 주소에 node_modules 폴더가 생기지 않게
        entryFileNames: chunk => `${npmPath(chunk.name)}.mjs`,
        chunkFileNames: chunk => `${npmPath(chunk.name)}.mjs`,
      },
    },
  },
})
