const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const TOOLKIT_DIR = path.join(__dirname, '..')
const TRUFFLEHOG = path.join(TOOLKIT_DIR, 'tools', 'trufflehog.exe')
const REPORTS_DIR = path.join(__dirname, '..', '..', 'reports')

function runTrufflehog(projectDir) {
    const projectName = path.basename(projectDir)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const reportFile = path.join(REPORTS_DIR, `trufflehog-${projectName}-${timestamp}.json`)

    console.log('\n🐷 [TRUFFLEHOG] Varredura profunda de secrets no histórico git...')
    console.log(`   Projeto: ${projectDir}`)

    if (!fs.existsSync(TRUFFLEHOG)) {
        console.error('❌ trufflehog.exe não encontrado em tools/')
        return false
    }

    if (!fs.existsSync(path.join(projectDir, '.git'))) {
        console.log('⚠️  Diretório não é um repositório git. Pulando.')
        return true
    }

    const ignoreFile = path.join(projectDir, '.trufflehogignore')
    const ignoreFlag = fs.existsSync(ignoreFile) ? `--exclude-paths="${ignoreFile}"` : ''

    try {
        execSync(
            `"${TRUFFLEHOG}" git "file://${projectDir.replace(/\\/g, '/')}" --json --no-update ${ignoreFlag} > "${reportFile}" 2>&1`,
            { stdio: 'pipe', timeout: 300000 }
        )
    } catch {
        // exit code != 0 quando encontra findings
    }

    if (fs.existsSync(reportFile)) {
        const raw = fs.readFileSync(reportFile, 'utf8')
        const lines = raw.split('\n').filter(l => l.trim())
        const findings = lines
            .map(l => { try { return JSON.parse(l) } catch { return null } })
            .filter(f => f && f.DetectorName) // apenas findings reais

        if (findings.length === 0) {
            console.log('✅ Nenhum secret encontrado!')
        } else {
            console.log(`\n🚨 ${findings.length} secret(s) encontrado(s)!\n`)

            // Agrupar por detector
            const byDetector = {}
            findings.forEach(f => {
                const d = f.DetectorName || 'Unknown'
                if (!byDetector[d]) byDetector[d] = []
                byDetector[d].push(f)
            })

            Object.entries(byDetector).forEach(([detector, items]) => {
                console.log(`  🔑 ${detector} (${items.length} ocorrência${items.length > 1 ? 's' : ''})`)
                items.slice(0, 3).forEach(f => {
                    console.log(`       Arquivo : ${f.SourceMetadata?.Data?.Git?.file || '-'}`)
                    console.log(`       Commit  : ${(f.SourceMetadata?.Data?.Git?.commit || '-').slice(0, 8)}`)
                    console.log(`       Trecho  : ${(f.Raw || '').slice(0, 30)}...`)
                })
                console.log()
            })

            console.log(`📄 Relatório completo: ${reportFile}`)
            return false
        }
    } else {
        console.log('⚠️  Trufflehog não gerou saída.')
    }

    return true
}

module.exports = { runTrufflehog }
