const { execSync, spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const { cmd } = require('./which-cmd')

const REPORTS_DIR = path.join(__dirname, '..', '..', 'reports')

// Regras por tipo de projeto
const RULESETS = {
    'Next.js':    'p/nextjs',
    'React':      'p/react',
    'Express':    'p/nodejs',
    'NestJS':     'p/nodejs',
    'Python':     'p/python',
    'PHP':        'p/php',
    'default':    'p/owasp-top-ten',
}

function getRuleset(frameworks = [], language = []) {
    for (const fw of frameworks) {
        if (RULESETS[fw]) return RULESETS[fw]
    }
    for (const lang of language) {
        if (RULESETS[lang]) return RULESETS[lang]
    }
    return RULESETS.default
}

function runSemgrep(projectDir, frameworks = [], language = []) {
    const projectName = path.basename(projectDir)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const reportFile = path.join(REPORTS_DIR, `semgrep-${projectName}-${timestamp}.json`)
    const ruleset = getRuleset(frameworks, language)

    console.log('\n🔬 [SEMGREP] Analisando código em busca de vulnerabilidades...')
    console.log(`   Ruleset : ${ruleset}`)
    console.log(`   Projeto : ${projectDir}`)

    // Verificar se semgrep está disponível
    const check = spawnSync('semgrep --version', { encoding: 'utf8', shell: true })
    if (check.error || check.status !== 0) {
        console.error('❌ semgrep não encontrado no sistema nem no venv local.')
        console.error('   Execute analisar.bat para realizar o setup automático.')
        return false
    }

    try {
        execSync(
            `semgrep scan --config "${ruleset}" --json --output "${reportFile}" "${projectDir}" --no-git-ignore 2>&1`,
            { stdio: 'pipe', timeout: 120000, shell: true }
        )
    } catch {}

    if (fs.existsSync(reportFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(reportFile, 'utf8'))
            const findings = data.results || []

            if (findings.length === 0) {
                console.log('✅ Nenhuma vulnerabilidade encontrada!')
            } else {
                const bySeverity = { ERROR: [], WARNING: [], INFO: [] }
                findings.forEach(f => {
                    const sev = f.extra?.severity || 'INFO'
                    ;(bySeverity[sev] || bySeverity.INFO).push(f)
                })

                console.log(`\n⚠️  ${findings.length} achado(s) encontrado(s):`)
                console.log(`   🔴 Crítico/Alto : ${bySeverity.ERROR.length}`)
                console.log(`   🟡 Médio        : ${bySeverity.WARNING.length}`)
                console.log(`   🔵 Info         : ${bySeverity.INFO.length}\n`)

                const toShow = [...bySeverity.ERROR, ...bySeverity.WARNING].slice(0, 10)
                toShow.forEach((f, i) => {
                    const file = f.path?.replace(projectDir, '').replace(/^[/\\]/, '')
                    const line = f.start?.line
                    console.log(`  [${i + 1}] ${f.check_id}`)
                    console.log(`       Arquivo : ${file}:${line}`)
                    console.log(`       Detalhe : ${(f.extra?.message || '').slice(0, 100)}`)
                    console.log()
                })

                if (findings.length > 10) {
                    console.log(`  ... e mais ${findings.length - 10} achados no relatório.`)
                }

                console.log(`📄 Relatório completo: ${reportFile}`)
            }
        } catch (e) {
            console.log('⚠️  Erro ao parsear resultado do semgrep:', e.message)
        }
    } else {
        console.log('⚠️  Semgrep não gerou relatório. Verifique conexão com internet (precisa baixar regras na 1ª vez).')
    }

    return true
}

module.exports = { runSemgrep }
