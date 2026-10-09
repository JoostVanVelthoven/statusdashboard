import { mkdir, readFile, writeFile } from 'node:fs/promises'

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8')
for (const route of ['settings', 'settings-json']) {
  const directory = new URL(`../dist/${route}/`, import.meta.url)
  await mkdir(directory, { recursive: true })
  await writeFile(new URL('index.html', directory), html)
}
