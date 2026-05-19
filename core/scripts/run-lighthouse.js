const { execSync, spawnSync, spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const { cmd } = require('./which-cmd')

const REPORTS_DIR = path.join(__dirname, '..', '..', 'reports')

// Aguarda o servidor responder na URL antes de prosseguir
function waitForServer(url, timeoutMs = 120000) {
    const http = require('http')
    const https = require('https')
    const lib = url.startsWith('https') ? https : http

    return new Promise((resolve, reject) => {
        const start = Date.now()
        const interval = setInterval(() => {
            if (Date.now() - start > timeoutMs) {
                clearInterval(interval)
                reject(new Error(`Servidor não respondeu em ${timeoutMs / 1000}s`))
                return
            }
            lib.get(url, { rejectUnauthorized: false }, () => {
                clearInterval(interval)
                resolve()
            }).on('error', () => {
                // ainda não está pronto, tenta de novo
            })
        }, 1500)
    })
}

// Detecta se o projeto tem script de build e start
function detectServerConfig(projectDir) {
    const pkgPath = path.join(projectDir, 'package.json')
    if (!fs.existsSync(pkgPath)) return null
    try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
        const scripts = pkg.scripts || {}
        return {
            hasBuild: !!scripts.build,
            hasStart: !!scripts.start,
            hasDev:   !!scripts.dev,
            manager:  fs.existsSync(path.join(projectDir, 'yarn.lock')) ? 'yarn' : 'npm',
        }
    } catch {
        return null
    }
}

function killServer(serverProcess) {
    if (!serverProcess) return
    try {
        if (process.platform === 'win32') {
            spawnSync(`taskkill /pid ${serverProcess.pid} /T /F`, { shell: true })
        } else {
            serverProcess.kill('SIGTERM')
        }
    } catch {}
}

// Sobe o servidor de produção e retorna { process, url } ou null se já estiver rodando / falhar
async function startServer(projectDir, url) {
    const http = require('http')
    const https = require('https')
    const lib = url.startsWith('https') ? https : http

    const alreadyRunning = await new Promise(resolve => {
        lib.get(url, { rejectUnauthorized: false }, () => resolve(true)).on('error', () => resolve(false))
    })

    if (alreadyRunning) {
        console.log(`   Servidor já rodando em ${url} — usando instância existente.`)
        return { process: null, startedByUs: false }
    }

    const config = detectServerConfig(projectDir)
    if (!config?.hasBuild || !config?.hasStart) {
        console.log(`\n   ⚠️  Servidor não está rodando em ${url} e não foi possível iniciá-lo automaticamente.`)
        return null
    }

    console.log(`   Nenhum servidor encontrado em ${url}.`)
    console.log(`   Iniciando build de produção... (pode levar 1-2 minutos)\n`)

    try {
        console.log('   ⚙️  Executando npm run build...')
        execSync(`${config.manager} run build`, {
            cwd: projectDir,
            stdio: 'inherit',
            timeout: 300000,
        })
        console.log('   ✅ Build concluído!\n')
    } catch (e) {
        console.error('   ❌ Falha no build:', e.message?.slice(0, 200))
        return null
    }

    console.log('   🚀 Iniciando servidor de produção...')
    const serverProcess = spawn(config.manager, ['run', 'start'], {
        cwd: projectDir,
        stdio: 'pipe',
        shell: true,
        detached: false,
    })

    serverProcess.stdout.on('data', d => {
        const line = d.toString()
        if (line.includes('localhost') || line.includes('ready') || line.includes('started')) {
            process.stdout.write(`   [servidor] ${line}`)
        }
    })

    serverProcess.stderr.on('data', d => {
        const line = d.toString()
        if (line.toLowerCase().includes('error')) {
            process.stderr.write(`   [servidor] ${line}`)
        }
    })

    try {
        process.stdout.write('   Aguardando servidor ficar pronto')
        const dots = setInterval(() => process.stdout.write('.'), 1500)
        await waitForServer(url, 60000)
        clearInterval(dots)
        console.log(' ✅')
        return { process: serverProcess, startedByUs: true }
    } catch (e) {
        console.error(`\n   ❌ ${e.message}`)
        killServer(serverProcess)
        return null
    }
}

async function runLighthouse(projectDir, url, externalServerProcess) {
    const projectName = path.basename(projectDir)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const reportBase = path.join(REPORTS_DIR, `lighthouse-${projectName}-${timestamp}`)
    const reportHtml = reportBase + '.report.html'
    const reportJson = reportBase + '.report.json'

    console.log('\n💡 [LIGHTHOUSE] Auditando performance e segurança do frontend...')

    const check = spawnSync('"' + cmd('lighthouse') + '" --version', { encoding: 'utf8', shell: true })
    if (check.error || check.status !== 0) {
        console.error('❌ lighthouse não encontrado. Execute analisar.bat para realizar o setup local.')
        return false
    }

    // Se recebeu servidor externo já rodando, usa direto
    let serverInfo = null
    if (externalServerProcess) {
        console.log(`   Usando servidor compartilhado em ${url}.`)
    } else {
        serverInfo = await startServer(projectDir, url)
        if (!serverInfo) return false
    }

    // Rodar Lighthouse
    console.log(`\n   🔍 Auditando ${url} (30-60 segundos)...`)
    try {
        execSync(
            `${cmd('lighthouse')} "${url}" --output json --output html --output-path "${reportBase}" --chrome-flags="--headless --no-sandbox --ignore-certificate-errors" --throttling.cpuSlowdownMultiplier=1 --quiet`,
            { stdio: 'pipe', timeout: 120000, shell: true }
        )
    } catch {
        // lighthouse pode retornar exit 1 mesmo com sucesso
    }

    // Derrubar servidor apenas se foi iniciado por este módulo (não compartilhado)
    if (serverInfo?.startedByUs) {
        console.log('\n   🛑 Encerrando servidor de produção...')
        killServer(serverInfo.process)
        console.log('   ✅ Servidor encerrado.')
    }

    // Exibir resultados
    if (fs.existsSync(reportJson)) {
        try {
            const data = JSON.parse(fs.readFileSync(reportJson, 'utf8'))
            const cats = data.categories || {}

            const score = (cat) => cat ? Math.round((cat.score || 0) * 100) : 'N/A'
            const icon  = (s) => typeof s === 'number' ? (s >= 90 ? '🟢' : s >= 50 ? '🟡' : '🔴') : '⚪'

            const perf = score(cats.performance)
            const acc  = score(cats.accessibility)
            const bp   = score(cats['best-practices'])
            const seo  = score(cats.seo)

            console.log('\n📊 Resultados:')
            console.log(`   ${icon(perf)} Performance   : ${perf}/100`)
            console.log(`   ${icon(acc)}  Acessibilidade : ${acc}/100`)
            console.log(`   ${icon(bp)}  Boas Práticas  : ${bp}/100`)
            console.log(`   ${icon(seo)}  SEO            : ${seo}/100`)

            const audits = data.audits || {}
            const opportunities = Object.values(audits)
                .filter(a => a.details?.type === 'opportunity' && a.score !== null && a.score < 1)
                .sort((a, b) => (a.score || 0) - (b.score || 0))
                .slice(0, 5)

            if (opportunities.length > 0) {
                console.log('\n⚡ Principais oportunidades de melhoria:')
                opportunities.forEach(o => {
                    const saving = o.details?.overallSavingsMs
                        ? ` (economiza ~${Math.round(o.details.overallSavingsMs)}ms)`
                        : ''
                    console.log(`   • ${o.title}${saving}`)
                })
            }

            const securityAudits = ['uses-https', 'no-vulnerable-libraries', 'csp-xss', 'geolocation-on-start', 'notification-on-start']
            const failed = securityAudits
                .filter(id => audits[id] && audits[id].score !== null && audits[id].score < 1)

            if (failed.length > 0) {
                console.log('\n⚠️  Alertas de segurança:')
                failed.forEach(id => console.log(`   ❌ ${audits[id].title}`))
            }

            console.log(`\n📄 Relatório completo: ${reportHtml}`)
            
            // Abertura nativa do navegador foi removida (agora exibimos o relatório no próprio app via UI).
            
        } catch (e) {
            console.log('⚠️  Erro ao parsear resultado:', e.message)
        }
    } else {
        console.log('⚠️  Lighthouse não gerou relatório. Verifique se o Chrome está instalado.')
    }

    return true
}

module.exports = { runLighthouse, startServer, killServer }
