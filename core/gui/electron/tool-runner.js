// Runner de ferramentas — chamado pelo Electron main process
// Uso: node tool-runner.js <toolId> <projectDir> [url]

const path = require('path')
const fs = require('fs')

const toolId = process.argv[2]
const projectDir = process.argv[3]
const url = process.argv[4] || null

if (!toolId || !projectDir) {
  process.stderr.write('Uso: node tool-runner.js <toolId> <projectDir> [url]')
  process.exit(1)
}

// Quando rodando dentro de app.asar empacotado, __dirname aponta para
// resources/app.asar/electron. Nesse caso subimos ate o .exe e depois ate core/.
// Em dev (__dirname = core/gui/electron), scripts/ esta 2 niveis acima.
const DEV_SCRIPTS = path.join(__dirname, '..', '..', 'scripts')
const SCRIPTS_DIR = fs.existsSync(DEV_SCRIPTS)
  ? DEV_SCRIPTS
  : path.resolve(path.dirname(process.execPath), '..', '..', '..', 'scripts')

const scriptMap = {
  gitleaks:    'run-gitleaks.js',
  trufflehog:  'run-trufflehog.js',
  semgrep:     'run-semgrep.js',
  depcheck:    'run-depcheck.js',
  madge:       'run-madge.js',
  snyk:        'run-snyk.js',
  nuclei:      'run-nuclei.js',
  lighthouse:  'run-lighthouse.js',
  observatory: 'run-observatory.js',
  k6:          'run-k6.js',
}

const scriptFile = scriptMap[toolId]
if (!scriptFile) {
  process.stderr.write('Ferramenta desconhecida: ' + toolId)
  process.exit(1)
}

const mod = require(path.join(SCRIPTS_DIR, scriptFile))
const fn = mod[Object.keys(mod)[0]]
let args = [projectDir]
if (url) args.push(url)

// Ajustes específicos por ferramenta
if (toolId === 'observatory') {
  args = [url] // observatory só recebe URL
} else if (toolId === 'semgrep') {
  args = [projectDir, [], []] // semgrep precisa de frameworks e language (arrays)
}

Promise.resolve(fn(...args))
  .then(r => {
    process.stdout.write('\n__RESULT__:' + (r ? 'true' : 'false'))
    process.exit(0)
  })
  .catch(e => {
    process.stderr.write(e.message || String(e))
    process.exit(1)
  })
