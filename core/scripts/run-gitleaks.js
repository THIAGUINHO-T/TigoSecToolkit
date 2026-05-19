const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const TOOLKIT_DIR = path.join(__dirname, '..')
const GITLEAKS = path.join(TOOLKIT_DIR, 'tools', 'gitleaks.exe')
const REPORTS_DIR = path.join(__dirname, '..', '..', 'reports')

function runGitleaks(projectDir) {
    const projectName = path.basename(projectDir)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const reportFile = path.join(REPORTS_DIR, `gitleaks-${projectName}-${timestamp}.json`)

    console.log('\n🔍 [GITLEAKS] Verificando secrets e credenciais expostas no histórico git...')
    console.log(`   Projeto: ${projectDir}`)

    if (!fs.existsSync(GITLEAKS)) {
        console.error('❌ gitleaks.exe não encontrado em tools/. Execute o setup novamente.')
        return false
    }

    if (!fs.existsSync(path.join(projectDir, '.git'))) {
        console.log('⚠️  Diretório não é um repositório git. Pulando gitleaks.')
        return true
    }

    try {
        execSync(
            `"${GITLEAKS}" detect --source "${projectDir}" --report-format json --report-path "${reportFile}" --no-banner`,
            { stdio: 'pipe' }
        )
        console.log('✅ Nenhum secret encontrado!')
    } catch (e) {
        const output = e.stdout?.toString() || ''
        const stderr = e.stderr?.toString() || ''

        if (e.status === 1 && fs.existsSync(reportFile)) {
            try {
                const results = JSON.parse(fs.readFileSync(reportFile, 'utf8'))
                if (results && results.length > 0) {
                    console.log(`\n🚨 ${results.length} secret(s) encontrado(s)!\n`)
                    results.forEach((finding, i) => {
                        console.log(`  [${i + 1}] Regra    : ${finding.RuleID}`)
                        console.log(`       Arquivo  : ${finding.File}:${finding.StartLine}`)
                        console.log(`       Commit   : ${finding.Commit?.slice(0, 8) || 'working tree'}`)
                        console.log(`       Autor    : ${finding.Author || '-'}`)
                        console.log(`       Trecho   : ${(finding.Secret || '').slice(0, 20)}...`)
                        console.log()
                    })
                    console.log(`📄 Relatório completo: ${reportFile}`)
                    return false
                }
            } catch {}
        }

        if (stderr.includes('no leaks found')) {
            console.log('✅ Nenhum secret encontrado!')
        } else {
            console.log('⚠️  gitleaks encerrou com status inesperado.')
            if (stderr) console.log('   Detalhe:', stderr.slice(0, 200))
        }
    }

    return true
}

module.exports = { runGitleaks }
