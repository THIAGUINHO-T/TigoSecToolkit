#!/usr/bin/env node
'use strict'

const path     = require('path')
const fs       = require('fs')
const readline = require('readline')

const IS_WIN = process.platform === 'win32'
// TOOLKIT_DIR é core/ (raiz lógica). Este script vive em core/scripts/.
const TOOLKIT_DIR = path.join(__dirname, '..')
const localBins = [
    path.join(TOOLKIT_DIR, 'node_modules', '.bin'),
    path.join(TOOLKIT_DIR, 'venv', IS_WIN ? 'Scripts' : 'bin'),
    path.join(TOOLKIT_DIR, 'tools')
]
process.env.PATH = localBins.join(path.delimiter) + path.delimiter + process.env.PATH

const { detectProject }   = require('./detect-project')
const { runGitleaks }                      = require('./run-gitleaks')
const { runTrufflehog }                    = require('./run-trufflehog')
const { runSemgrep }                       = require('./run-semgrep')
const { runSnyk }                          = require('./run-snyk')
const { runNuclei }                        = require('./run-nuclei')
const { runObservatory }                   = require('./run-observatory')
const { runLighthouse, startServer, killServer } = require('./run-lighthouse')
const { runK6 }                            = require('./run-k6')
const { runDepcheck }                      = require('./run-depcheck')
const { runMadge }                         = require('./run-madge')

// ─── Utilitários ─────────────────────────────────────────────────────────────

// No Windows via cmd.exe o terminal já exibe o eco — desativar o eco do readline para evitar duplicação
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdin.isTTY && process.platform !== 'win32' ? true : false,
})
const ask = (q) => new Promise(resolve => {
    process.stdout.write(q)
    rl.once('line', resolve)
})

function header(text) {
    const line = '─'.repeat(60)
    console.log(`\n${line}`)
    console.log(`  ${text}`)
    console.log(line)
}

function printProjectInfo(dir, info) {
    header('🔎 PROJETO DETECTADO')
    console.log(`  Diretório  : ${dir}`)
    console.log(`  Git        : ${info.hasGit ? '✅' : '❌'}`)
    console.log(`  Docker     : ${info.hasDocker ? '✅' : '❌'}`)
    console.log(`  Prisma     : ${info.hasPrisma ? '✅' : '❌'}`)
    console.log(`  Linguagens : ${info.language.join(', ') || 'não detectada'}`)
    console.log(`  Frameworks : ${info.frameworks.join(', ') || 'não detectado'}`)
    if (info.packageJson?.name) {
        console.log(`  Nome       : ${info.packageJson.name}`)
        console.log(`  Versão     : ${info.packageJson.version || '-'}`)
    }
}

function printMenu() {
    header('🛡️  TigoSecToolkit — Menu Principal')
    console.log('  ── Análise Completa ───────────────────────────────────')
    console.log('  [0] Análise COMPLETA (todos os módulos)')
    console.log()
    console.log('  ── Secrets & Credenciais ──────────────────────────────')
    console.log('  [1] Gitleaks     — secrets no histórico git')
    console.log('  [2] Trufflehog   — varredura profunda de secrets')
    console.log()
    console.log('  ── Código-fonte ───────────────────────────────────────')
    console.log('  [3] Semgrep      — vulnerabilidades no código')
    console.log('  [4] Depcheck     — dependências não utilizadas')
    console.log('  [5] Madge        — dependências circulares')
    console.log()
    console.log('  ── Dependências & CVEs ────────────────────────────────')
    console.log('  [6] Snyk         — CVEs nas dependências')
    console.log('  [7] Nuclei       — CVEs conhecidos nas rotas da API')
    console.log()
    console.log('  ── Frontend & HTTP ────────────────────────────────────')
    console.log('  [8] Lighthouse   — performance e segurança do frontend')
    console.log('  [9] Observatory  — headers HTTP de segurança (URL pública)')
    console.log()
    console.log('  ── Carga & Estabilidade ───────────────────────────────')
    console.log('  [10] k6          — teste de carga e limites do servidor')
    console.log()
    console.log('  [s] Sair')
    console.log()
}

async function getProjectDir() {
    if (process.argv[2]) {
        const dir = path.resolve(process.argv[2])
        if (!fs.existsSync(dir)) {
            console.error(`❌ Diretório não encontrado: ${dir}`)
            process.exit(1)
        }
        return dir
    }

    console.log('\n🔧  TigoSecToolkit — Análise de Projetos')
    console.log('    Deixe em branco para usar o diretório atual.\n')
    const input = await ask('📁 Caminho do projeto a analisar: ')
    const dir = input.trim() ? path.resolve(input.trim()) : process.cwd()

    if (!fs.existsSync(dir)) {
        console.error(`❌ Diretório não encontrado: ${dir}`)
        process.exit(1)
    }
    return dir
}

async function getUrl(projectDir, label) {
    let defaultUrl = 'http://localhost:3000'
    const envPath = path.join(projectDir, '.env')
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8')
        const match = envContent.match(/NEXT_PUBLIC_APP_URL\s*=\s*["']?([^"'\n]+)["']?/)
            || envContent.match(/APP_URL\s*=\s*["']?([^"'\n]+)["']?/)
        if (match) defaultUrl = match[1].trim()
    }
    const input = await ask(`\n🌐 ${label} [${defaultUrl}]: `)
    return input.trim() || defaultUrl
}

async function runModule(choice, projectDir, info) {
    switch (choice) {
        case '1':  return runGitleaks(projectDir)
        case '2':  return runTrufflehog(projectDir)
        case '3':  return runSemgrep(projectDir, info.frameworks, info.language)
        case '4':  return runDepcheck(projectDir)
        case '5':  return runMadge(projectDir)
        case '6':  return runSnyk(projectDir)
        case '7': {
            const url = await getUrl(projectDir, 'URL para scan Nuclei')
            return runNuclei(projectDir, url)
        }
        case '8': {
            const url = await getUrl(projectDir, 'URL para Lighthouse')
            return runLighthouse(projectDir, url)
        }
        case '9': {
            const url = await getUrl(projectDir, 'URL pública para Observatory')
            return runObservatory(url)
        }
        case '10': {
            const url = await getUrl(projectDir, 'URL para teste de carga k6')
            return runK6(projectDir, url)
        }
        default: return null
    }
}

async function runAll(projectDir, info) {
    const url = await getUrl(projectDir, 'URL base do projeto (usada por Nuclei, Lighthouse, k6, Observatory)')

    const results = {}

    // ── Módulos sem servidor ──────────────────────────────────────────────────
    results['Gitleaks (secrets git)']      = await runGitleaks(projectDir)
    results['Trufflehog (secrets profundo)']= await runTrufflehog(projectDir)
    results['Semgrep (código-fonte)']      = await runSemgrep(projectDir, info.frameworks, info.language)
    results['Depcheck (deps não usadas)']  = await runDepcheck(projectDir)
    results['Madge (dependências circulares)'] = await runMadge(projectDir)
    results['Snyk (CVEs nas deps)']        = await runSnyk(projectDir)

    // ── Módulos que precisam de servidor local ────────────────────────────────
    // Sobe UMA vez e compartilha entre Nuclei, Lighthouse e k6
    let sharedServer = null
    const needsLocalServer = url.startsWith('http://localhost') || url.startsWith('http://127.')

    if (needsLocalServer) {
        console.log('\n🚀 Subindo servidor local compartilhado para Nuclei, Lighthouse e k6...')
        sharedServer = await startServer(projectDir, url)
        if (!sharedServer) {
            console.log('   ⚠️  Não foi possível subir o servidor — Nuclei, Lighthouse e k6 serão pulados.')
            results['Nuclei (CVEs na API)']   = false
            results['Lighthouse (frontend)']  = false
            results['k6 (carga)']             = false
        }
    }

    const serverReady = !needsLocalServer || sharedServer !== null
    if (serverReady) {
        results['Nuclei (CVEs na API)']  = await runNuclei(projectDir, url)
        // Passa processo externo para o Lighthouse não derrubar o servidor ao terminar
        results['Lighthouse (frontend)'] = await runLighthouse(projectDir, url, sharedServer?.process ?? true)
        results['k6 (carga)']            = await runK6(projectDir, url)
    }
    results['Observatory (headers HTTP)'] = await runObservatory(url)

    // Derruba o servidor compartilhado após todos os módulos
    if (sharedServer?.startedByUs) {
        console.log('\n   🛑 Encerrando servidor de produção compartilhado...')
        killServer(sharedServer.process)
        console.log('   ✅ Servidor encerrado.')
    }

    header('📋 RESUMO DA ANÁLISE COMPLETA')
    Object.entries(results).forEach(([label, ok]) => {
        const icon = ok === true ? '✅' : ok === false ? '❌' : '⏭️ '
        console.log(`  ${icon}  ${label}`)
    })

    const reportsDir = path.join(__dirname, '..', 'reports')
    console.log(`\n📁 Todos os relatórios em: ${reportsDir}\n`)
}

async function main() {
    const projectDir = await getProjectDir()
    const info = detectProject(projectDir)

    printProjectInfo(projectDir, info)

    const reportsDir = path.join(__dirname, '..', 'reports')
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true })

    let running = true
    while (running) {
        printMenu()
        const choice = (await ask('  Escolha uma opção: ')).trim().toLowerCase()

        if (choice === 's' || choice === '0' && false) {
            running = false
        } else if (choice === '0') {
            await runAll(projectDir, info)
            running = false
        } else if (['1','2','3','4','5','6','7','8','9','10'].includes(choice)) {
            await runModule(choice, projectDir, info)
            const again = await ask('\n  Voltar ao menu? [S/n]: ')
            if (again.trim().toLowerCase() === 'n') running = false
        } else if (choice === 's') {
            running = false
        } else {
            console.log('  ❌ Opção inválida.')
        }
    }

    console.log('\n👋 Até logo!\n')
    rl.close()
}

main().catch(e => {
    console.error('Erro inesperado:', e.message)
    process.exit(1)
})
