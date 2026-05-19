const { execSync, spawnSync } = require('child_process')
const https = require('https')
const fs = require('fs')
const path = require('path')

// Ignorar erros de certificado SSL (comum em ambientes corporativos/proxies)
// Isso resolve o erro "unable to get local issuer certificate"
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// TOOLKIT_DIR é core/. Em dev este script vive em core/scripts/.
// Quando empacotado pelo electron-builder, e copiado para
// release/win-unpacked/resources/setup.js — entao subimos a partir do .exe
// (win-unpacked/ -> release/ -> gui/ -> core/).
function resolveToolkitDir() {
    const devCandidate = path.join(__dirname, '..')
    if (fs.existsSync(path.join(devCandidate, 'scripts', 'setup.js'))) {
        return devCandidate
    }
    // Empacotado: process.execPath = .../win-unpacked/TigoSecToolkit.exe
    return path.resolve(path.dirname(process.execPath), '..', '..', '..')
}
const TOOLKIT_DIR = resolveToolkitDir()
const TOOLS_DIR = path.join(TOOLKIT_DIR, 'tools')
const IS_WIN = process.platform === 'win32'

// Adicionar caminhos locais ao PATH para o processo atual e filhos
const localBins = [
    path.join(TOOLKIT_DIR, 'node_modules', '.bin'),
    path.join(TOOLKIT_DIR, 'venv', IS_WIN ? 'Scripts' : 'bin'),
    TOOLS_DIR
]
process.env.PATH = localBins.join(path.delimiter) + path.delimiter + process.env.PATH

// ─── Utilitários ─────────────────────────────────────────────────────────────

function ok(msg)   { console.log(`  [OK] ${msg}`) }
function fail(msg) { console.log(`  [ERRO] ${msg}`) }
function info(msg) { console.log(`  [INFO] ${msg}`) }
function warn(msg) { console.log(`  [AVISO] ${msg}`) }
function header(t) { console.log(`\n--- ${t} ---\n`) }

function which(cmd) {
    const r = spawnSync(IS_WIN ? 'where' : 'which', [cmd], { encoding: 'utf8', stdio: 'pipe' })
    return !r.error && r.status === 0 && r.stdout.trim().length > 0
}

function run(cmd, opts = {}) {
    try {
        execSync(cmd, { stdio: 'pipe', ...opts })
        return true
    } catch {
        return false
    }
}

function version(cmd, args = ['--version']) {
    const r = spawnSync(cmd, args, { encoding: 'utf8', stdio: 'pipe', shell: IS_WIN })
    return (r.stdout || r.stderr || '').trim().split('\n')[0]
}

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest)
        const follow = (u) => {
            const options = { 
                headers: { 'User-Agent': 'security-toolkit-setup' },
                rejectUnauthorized: false // Reforço explícito
            }
            https.get(u, options, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    follow(res.headers.location)
                    return
                }
                res.pipe(file)
                file.on('finish', () => { file.close(); resolve() })
            }).on('error', reject)
        }
        follow(url)
    })
}

function unzip(zipPath, destDir, fileGlob) {
    if (IS_WIN) {
        // PowerShell nativo — disponível no Windows 7+
        run(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`)
    } else {
        run(`unzip -o "${zipPath}" ${fileGlob || ''} -d "${destDir}"`)
    }
}

function untargz(tarPath, destDir) {
    run(`tar -xzf "${tarPath}" -C "${destDir}"`)
}

// Busca a URL de download da última release do GitHub
function getLatestRelease(repo, assetPattern) {
    return new Promise((resolve, reject) => {
        const opts = {
            hostname: 'api.github.com',
            path: `/repos/${repo}/releases/latest`,
            headers: { 'User-Agent': 'security-toolkit-setup', 'Accept': 'application/vnd.github.v3+json' },
            rejectUnauthorized: false
        }
        https.get(opts, (res) => {
            let data = ''
            res.on('data', d => data += d)
            res.on('end', () => {
                try {
                    const release = JSON.parse(data)
                    const asset = (release.assets || []).find(a => assetPattern.test(a.name))
                    if (asset) resolve({ url: asset.browser_download_url, version: release.tag_name })
                    else reject(new Error(`Asset não encontrado para ${repo}`))
                } catch(e) { reject(e) }
            })
        }).on('error', reject)
    })
}

// ─── Verificações de pré-requisito ───────────────────────────────────────────

async function checkNode() {
    if (!which('node')) {
        fail('Node.js não encontrado!')
        info('Instale em: https://nodejs.org')
        return false
    }
    ok(`Node.js ${version('node')}`)
    return true
}

async function checkPython() {
    const cmd = which('python') ? 'python' : which('python3') ? 'python3' : null
    if (!cmd) {
        warn('Python não encontrado — Semgrep não estará disponível.')
        info('Instale em: https://python.org')
        return false
    }
    ok(`Python ${version(cmd)}`)
    return cmd
}

async function checkGit() {
    if (!which('git')) {
        warn('Git não encontrado — Gitleaks/Trufflehog não conseguirão escanear histórico.')
        info('Instale em: https://git-scm.com')
        return false
    }
    ok(`Git ${version('git')}`)
    return true
}

// ─── Instaladores npm locais ──────────────────────────────────────────────────

async function installNpmLocal(pkg, checkCmd) {
    const cmd = checkCmd || pkg.split('/').pop()
    const binPath = path.join(TOOLKIT_DIR, 'node_modules', '.bin', IS_WIN ? `${cmd}.cmd` : cmd)
    
    if (fs.existsSync(binPath)) {
        const v = spawnSync(binPath, ['--version'], { encoding: 'utf8', stdio: 'pipe', shell: true })
        if (!v.error && v.status === 0) {
            ok(`${cmd} já instalado localmente (${(v.stdout || '').trim().split('\n')[0]})`)
            return true
        }
    }

    process.stdout.write(`  📦 Instalando ${pkg} localmente... (isso pode demorar)\n`)
    // Usamos 'inherit' para que o usuário veja o progresso do npm e não ache que travou
    const success = run(`npm install --save-dev ${pkg} --strict-ssl=false`, { cwd: TOOLKIT_DIR, shell: true, stdio: 'inherit' })
    if (success) { console.log(`\n  ✅ ${pkg} instalado.`) } else { console.log(`\n  ❌ Falha ao instalar ${pkg}.`) }
    return success
}

// ─── Instaladores pip (venv) ──────────────────────────────────────────────────

async function setupPythonVenv(pythonCmd) {
    const venvDir = path.join(TOOLKIT_DIR, 'venv')
    if (fs.existsSync(venvDir)) {
        ok('Ambiente virtual Python (venv) já existe.')
        return true
    }
    process.stdout.write('  🐍 Criando ambiente virtual Python...')
    const success = run(`${pythonCmd} -m venv venv`, { cwd: TOOLKIT_DIR, shell: true })
    if (success) { console.log(' ✅') } else { console.log(' ❌') }
    return success
}

async function installPipLocal(pkg) {
    const pipCmd = IS_WIN ? path.join(TOOLKIT_DIR, 'venv', 'Scripts', 'pip.exe') : path.join(TOOLKIT_DIR, 'venv', 'bin', 'pip')
    const exeCmd = IS_WIN ? path.join(TOOLKIT_DIR, 'venv', 'Scripts', `${pkg}.exe`) : path.join(TOOLKIT_DIR, 'venv', 'bin', pkg)

    if (fs.existsSync(exeCmd)) {
        ok(`${pkg} já instalado no venv.`)
        return true
    }

    process.stdout.write(`  📦 Instalando ${pkg} no venv...`)
    const success = run(`"${pipCmd}" install ${pkg} --quiet --trusted-host pypi.org --trusted-host files.pythonhosted.org`, { shell: true })
    if (success) { console.log(' ✅') } else { console.log(' ❌') }
    return success
}

// ─── Instaladores de portables ────────────────────────────────────────────────

async function installPortable({ name, repo, assetPattern, exe, extractFn }) {
    const exePath = path.join(TOOLS_DIR, exe)
    if (fs.existsSync(exePath)) {
        const v = spawnSync(exePath, ['--version'], { encoding: 'utf8', stdio: 'pipe' })
        ok(`${name} já instalado (${(v.stdout || v.stderr || '').trim().split('\n')[0]})`)
        return true
    }

    process.stdout.write(`  📥 Baixando ${name}...`)
    try {
        const { url, version: ver } = await getLatestRelease(repo, assetPattern)
        const tmpFile = path.join(TOOLS_DIR, `_tmp_${name}${url.endsWith('.tar.gz') ? '.tar.gz' : '.zip'}`)

        await download(url, tmpFile)
        console.log(` ${ver}`)

        process.stdout.write(`  📦 Extraindo ${name}...`)
        await extractFn(tmpFile, TOOLS_DIR)
        fs.unlinkSync(tmpFile)

        if (fs.existsSync(exePath)) {
            console.log(' ✅')
            return true
        } else {
            // Tentar encontrar o exe em subpastas e mover
            const found = findFile(TOOLS_DIR, exe)
            if (found && found !== exePath) {
                fs.renameSync(found, exePath)
                console.log(' ✅')
                return true
            }
            console.log(' ❌ exe não encontrado após extração')
            return false
        }
    } catch(e) {
        console.log(` ❌ ${e.message}`)
        return false
    }
}

function findFile(dir, filename) {
    for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry)
        if (entry === filename) return full
        if (fs.statSync(full).isDirectory()) {
            const found = findFile(full, filename)
            if (found) return found
        }
    }
    return null
}

// ─── Configurações das ferramentas ───────────────────────────────────────────

const PORTABLES = [
    {
        name: 'Gitleaks',
        repo: 'gitleaks/gitleaks',
        assetPattern: /gitleaks_[\d.]+_windows_x64\.zip$/i,
        exe: 'gitleaks.exe',
        extractFn: async (tmp, dest) => {
            unzip(tmp, dest)
        },
    },
    {
        name: 'Trufflehog',
        repo: 'trufflesecurity/trufflehog',
        assetPattern: /trufflehog_[\d.]+_windows_amd64\.tar\.gz$/i,
        exe: 'trufflehog.exe',
        extractFn: async (tmp, dest) => {
            untargz(tmp, dest)
        },
    },
    {
        name: 'Nuclei',
        repo: 'projectdiscovery/nuclei',
        assetPattern: /nuclei_[\d.]+_windows_amd64\.zip$/i,
        exe: 'nuclei.exe',
        extractFn: async (tmp, dest) => {
            unzip(tmp, dest)
        },
    },
    {
        name: 'k6',
        repo: 'grafana/k6',
        assetPattern: /k6-v[\d.]+-windows-amd64\.zip$/i,
        exe: 'k6.exe',
        extractFn: async (tmp, dest) => {
            unzip(tmp, dest)
            // k6 extrai para subpasta — findFile vai resolver
        },
    },
]

const NPM_TOOLS = [
    { pkg: 'snyk',       cmd: 'snyk'       },
    { pkg: 'lighthouse', cmd: 'lighthouse' },
    { pkg: 'madge',      cmd: 'madge'      },
    { pkg: 'depcheck',   cmd: 'depcheck'   },
    { pkg: 'artillery',  cmd: 'artillery'  },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const targetTool = process.argv[2] ? process.argv[2].toLowerCase() : null

    if (targetTool) {
        console.log(`TigoSecToolkit - Setup Individual: ${targetTool}`)
    } else {
        console.log('TigoSecToolkit - Setup Silencioso')
        console.log('Iniciando configuracao do ambiente...')
    }

    if (!fs.existsSync(TOOLS_DIR)) fs.mkdirSync(TOOLS_DIR, { recursive: true })
    if (!fs.existsSync(path.join(TOOLKIT_DIR, '..', 'reports'))) {
        fs.mkdirSync(path.join(TOOLKIT_DIR, '..', 'reports'), { recursive: true })
    }

    // Pré-requisito Node.js é obrigatório
    const hasNode = await checkNode()
    if (!hasNode) {
        console.log('\n❌ Node.js é obrigatório. Instale e execute o setup novamente.')
        process.exit(1)
    }

    if (targetTool) {
        // --- INSTALAÇÃO DE UMA FERRAMENTA ESPECÍFICA ---

        // 1. Portables (Gitleaks, Trufflehog, Nuclei, k6)
        const portable = PORTABLES.find(p => p.name.toLowerCase() === targetTool || p.exe.replace('.exe', '').toLowerCase() === targetTool)
        if (portable) {
            if (portable.name === 'Gitleaks' || portable.name === 'Trufflehog') {
                await checkGit()
            }
            if (IS_WIN) {
                const success = await installPortable(portable)
                process.exit(success ? 0 : 1)
            } else {
                warn('Portables Windows (.exe) — estamos em Linux/Mac.')
                process.exit(1)
            }
        }

        // 2. NPM Tools (Snyk, Lighthouse, Madge, Depcheck, Artillery)
        const npmTool = NPM_TOOLS.find(t => t.cmd === targetTool || t.pkg === targetTool)
        if (npmTool) {
            const success = await installNpmLocal(npmTool.pkg, npmTool.cmd)
            process.exit(success ? 0 : 1)
        }

        // 3. Semgrep (Python / Venv)
        if (targetTool === 'semgrep') {
            const pythonCmd = await checkPython()
            if (!pythonCmd) {
                fail('Python não encontrado — Semgrep requer Python 3.')
                process.exit(1)
            }
            const hasVenv = await setupPythonVenv(pythonCmd)
            if (hasVenv) {
                const success = await installPipLocal('semgrep')
                process.exit(success ? 0 : 1)
            }
            process.exit(1)
        }

        fail(`Ferramenta desconhecida ou não suportada para instalação individual: ${targetTool}`)
        process.exit(1)
    }

    // --- INSTALAÇÃO COMPLETA DE TODAS AS FERRAMENTAS ---
    header('1/5 — Pré-requisitos do sistema')
    const pythonCmd = await checkPython()
    await checkGit()

    header('2/5 — Ferramentas portables (tools/)')
    if (IS_WIN) {
        for (const tool of PORTABLES) {
            await installPortable(tool)
        }
    } else {
        warn('Portables Windows (.exe) — estamos em Linux/Mac.')
        info('Instale gitleaks, trufflehog, nuclei e k6 manualmente via brew ou apt.')
    }

    header('3/5 — Ferramentas npm locais')
    for (const { pkg, cmd } of NPM_TOOLS) {
        await installNpmLocal(pkg, cmd)
    }

    header('4/5 — Ferramentas Python (venv)')
    if (pythonCmd) {
        const hasVenv = await setupPythonVenv(pythonCmd)
        if (hasVenv) {
            await installPipLocal('semgrep')
        }
    } else {
        warn('Python não disponível — semgrep pulado.')
    }

    // Instalar dependências locais do toolkit (package.json)
    if (fs.existsSync(path.join(TOOLKIT_DIR, 'package.json'))) {
        process.stdout.write('\n  📦 Garantindo dependências do toolkit...')
        run('npm install --silent', { cwd: TOOLKIT_DIR, shell: true })
        console.log(' ✅')
    }

    // Buildar a GUI (Electron + Vite)
    const guiDir = path.join(TOOLKIT_DIR, 'gui')
    if (fs.existsSync(path.join(guiDir, 'package.json'))) {
        header('5/5 — Interface gráfica (GUI)')
        const guiModules = path.join(guiDir, 'node_modules')
        if (!fs.existsSync(guiModules)) {
            process.stdout.write('  📦 Instalando dependências da GUI (pode demorar)...')
            const ok1 = run('npm install --silent', { cwd: guiDir, shell: true })
            console.log(ok1 ? ' ✅' : ' ❌')
        } else {
            ok('Dependências da GUI já instaladas.')
        }
        const guiDist = path.join(guiDir, 'dist', 'index.html')
        if (!fs.existsSync(guiDist)) {
            process.stdout.write('  🔨 Compilando interface (vite build)...')
            const ok2 = run('npm run build', { cwd: guiDir, shell: true })
            console.log(ok2 ? ' ✅' : ' ❌')
        } else {
            ok('Build da GUI já existe.')
        }
    }

    header('✅ Setup concluído!')
    console.log('  O TigoSecToolkit ja pode ser iniciado.\n')

    // Aviso sobre Snyk (requer auth manual)
    const snykBin = path.join(TOOLKIT_DIR, 'node_modules', '.bin', IS_WIN ? 'snyk.cmd' : 'snyk')
    const snykCheck = spawnSync(snykBin, ['auth', '--status'], { encoding: 'utf8', stdio: 'pipe', shell: true })
    if ((snykCheck.stdout + snykCheck.stderr).toLowerCase().includes('unauthenticated')) {
        console.log('  ⚠️  Snyk requer autenticação (gratuita):')
        console.log('      1. Execute: snyk auth')
        console.log('      2. Faça login no navegador que abrir\n')
    }
}

main().catch(e => {
    console.error('\n❌ Erro no setup:', e.message)
    process.exit(1)
})
