const { execSync, spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const { cmd } = require('./which-cmd')

const REPORTS_DIR = path.join(__dirname, '..', '..', 'reports')

function runDepcheck(projectDir) {
    const projectName = path.basename(projectDir)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const reportFile = path.join(REPORTS_DIR, `depcheck-${projectName}-${timestamp}.json`)

    console.log('\n🧹 [DEPCHECK] Verificando dependências não utilizadas...')
    console.log(`   Projeto: ${projectDir}`)

    if (!fs.existsSync(path.join(projectDir, 'package.json'))) {
        console.log('⚠️  Nenhum package.json encontrado. Pulando.')
        return true
    }

    const check = spawnSync('"' + cmd('depcheck') + '" --version', { encoding: 'utf8', shell: true })
    if (check.error) {
        console.error('❌ depcheck não encontrado. Execute: npm install -g depcheck')
        return false
    }

    try {
        execSync(
            `${cmd('depcheck')} "${projectDir}" --json > "${reportFile}" 2>&1`,
            { stdio: 'pipe', timeout: 60000, shell: true }
        )
    } catch {
        // depcheck retorna exit 1 quando encontra dependências não usadas
    }

    if (fs.existsSync(reportFile)) {
        try {
            const raw = fs.readFileSync(reportFile, 'utf8')
            // depcheck pode misturar output com o JSON — pegar só o JSON
            const jsonStart = raw.indexOf('{')
            const data = JSON.parse(raw.slice(jsonStart))

            const unused = data.dependencies || []
            const unusedDev = data.devDependencies || []
            const missing = Object.keys(data.missing || {})

            if (unused.length === 0 && unusedDev.length === 0 && missing.length === 0) {
                console.log('✅ Nenhuma dependência não utilizada encontrada!')
            } else {
                if (unused.length > 0) {
                    console.log(`\n📦 Dependências não utilizadas (${unused.length}) — podem ser removidas:`)
                    unused.forEach(d => console.log(`   • ${d}`))
                }

                if (unusedDev.length > 0) {
                    console.log(`\n🔧 DevDependencies não utilizadas (${unusedDev.length}):`)
                    unusedDev.forEach(d => console.log(`   • ${d}`))
                }

                if (missing.length > 0) {
                    console.log(`\n⚠️  Dependências usadas mas não declaradas no package.json (${missing.length}):`)
                    missing.forEach(d => {
                        const files = (data.missing[d] || []).slice(0, 2).join(', ')
                        console.log(`   • ${d}  ← usado em: ${files}`)
                    })
                }

                const totalUnused = unused.length + unusedDev.length
                if (totalUnused > 0) {
                    console.log(`\n💡 Para remover as não utilizadas: npm uninstall ${[...unused, ...unusedDev].slice(0, 5).join(' ')} ...`)
                }

                console.log(`\n📄 Relatório completo: ${reportFile}`)
            }
        } catch (e) {
            console.log('⚠️  Erro ao parsear resultado:', e.message)
        }
    }

    return true
}

module.exports = { runDepcheck }
