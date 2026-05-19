const { execSync, spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const TOOLKIT_DIR = path.join(__dirname, '..')
const NUCLEI = path.join(TOOLKIT_DIR, 'tools', 'nuclei.exe')
const REPORTS_DIR = path.join(__dirname, '..', '..', 'reports')

// Templates focados em APIs web e auth — evita ruído desnecessário
const TEMPLATES = [
    'http/cves/',
    'http/exposures/',
    'http/misconfiguration/',
    'http/takeovers/',
    'http/vulnerabilities/',
]

async function runNuclei(projectDir, url) {
    const projectName = path.basename(projectDir)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const reportFile = path.join(REPORTS_DIR, `nuclei-${projectName}-${timestamp}.json`)

    console.log('\n🎯 [NUCLEI] Testando rotas da API contra vulnerabilidades conhecidas...')
    console.log(`   URL     : ${url}`)

    if (!fs.existsSync(NUCLEI)) {
        console.error('❌ nuclei.exe não encontrado em tools/')
        return false
    }

    // Atualizar templates na primeira vez
    const templatesDir = path.join(TOOLKIT_DIR, 'tools', 'nuclei-templates')
    if (!fs.existsSync(templatesDir)) {
        console.log('   📥 Baixando templates do Nuclei (apenas na primeira vez)...')
        try {
            execSync(`"${NUCLEI}" -update-templates -ud "${templatesDir}"`, {
                stdio: 'pipe', timeout: 120000
            })
            console.log('   ✅ Templates atualizados!')
        } catch {
            console.log('   ⚠️  Não foi possível atualizar templates. Continuando com os existentes.')
        }
    }

    console.log('   ⏳ Executando scan (pode levar 2-5 minutos)...')

    const templateArgs = TEMPLATES.map(t => `-t "${path.join(templatesDir, t)}"`).join(' ')

    try {
        execSync(
            `"${NUCLEI}" -u "${url}" ${templateArgs} -je "${reportFile}" -silent -nc -timeout 10 -rate-limit 50`,
            { stdio: 'pipe', timeout: 600000 }
        )
    } catch {
        // nuclei retorna exit code != 0 quando encontra findings
    }

    if (fs.existsSync(reportFile)) {
        try {
            const lines = fs.readFileSync(reportFile, 'utf8')
                .split('\n')
                .filter(l => l.trim())
            const findings = lines.map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)

            if (findings.length === 0) {
                console.log('✅ Nenhuma vulnerabilidade encontrada!')
            } else {
                const bySev = { critical: [], high: [], medium: [], low: [], info: [] }
                findings.forEach(f => {
                    const s = f.info?.severity || 'info'
                    ;(bySev[s] || bySev.info).push(f)
                })

                console.log(`\n🚨 ${findings.length} achado(s) encontrado(s):`)
                console.log(`   🔴 Crítico : ${bySev.critical.length}`)
                console.log(`   🟠 Alto    : ${bySev.high.length}`)
                console.log(`   🟡 Médio   : ${bySev.medium.length}`)
                console.log(`   🔵 Baixo   : ${bySev.low.length}`)
                console.log(`   ⚪ Info    : ${bySev.info.length}`)

                const toShow = [...bySev.critical, ...bySev.high, ...bySev.medium].slice(0, 8)
                if (toShow.length > 0) {
                    console.log()
                    toShow.forEach((f, i) => {
                        console.log(`  [${i + 1}] ${f.info?.severity?.toUpperCase()} — ${f.info?.name}`)
                        console.log(`       URL      : ${f['matched-at'] || f.host}`)
                        console.log(`       Template : ${f['template-id']}`)
                        if (f.info?.description) console.log(`       Detalhe  : ${f.info.description.slice(0, 100)}`)
                        console.log()
                    })
                }

                console.log(`📄 Relatório completo: ${reportFile}`)
            }
        } catch (e) {
            console.log('⚠️  Erro ao parsear resultado:', e.message)
        }
    } else {
        console.log('⚠️  Nuclei não gerou relatório.')
    }

    return true
}

module.exports = { runNuclei }
