const { execSync, spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const { cmd } = require('./which-cmd')

const REPORTS_DIR = path.join(__dirname, '..', '..', 'reports')

function runMadge(projectDir) {
    const projectName = path.basename(projectDir)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const reportFile = path.join(REPORTS_DIR, `madge-${projectName}-${timestamp}.json`)
    const imageFile  = path.join(REPORTS_DIR, `madge-${projectName}-${timestamp}.svg`)

    console.log('\n🕸️  [MADGE] Mapeando dependências circulares entre módulos...')
    console.log(`   Projeto: ${projectDir}`)

    const check = spawnSync('"' + cmd('madge') + '" --version', { encoding: 'utf8', shell: true })
    if (check.error) {
        console.error('❌ madge não encontrado. Execute: npm install -g madge')
        return false
    }

    // Detectar pasta de entrada (src ou app ou raiz)
    const entryDir = ['src', 'app', 'lib'].find(d => fs.existsSync(path.join(projectDir, d)))
        || projectDir

    // Detectar se é TypeScript
    const isTS = fs.existsSync(path.join(projectDir, 'tsconfig.json'))
    const tsFlag = isTS ? '--ts-config tsconfig.json' : ''

    try {
        // Verificar dependências circulares
        execSync(
            `${cmd('madge')} --circular --json ${tsFlag} "${entryDir}" > "${reportFile}" 2>&1`,
            { stdio: 'pipe', timeout: 60000, shell: true, cwd: projectDir }
        )
    } catch {
        // exit code != 0 quando há circulares
    }

    let circularCount = 0
    if (fs.existsSync(reportFile)) {
        try {
            const raw = fs.readFileSync(reportFile, 'utf8')
            const jsonStart = raw.indexOf('[')
            const circulars = jsonStart >= 0 ? JSON.parse(raw.slice(jsonStart)) : []
            circularCount = circulars.length

            if (circularCount === 0) {
                console.log('✅ Nenhuma dependência circular encontrada!')
            } else {
                console.log(`\n⚠️  ${circularCount} ciclo(s) de dependência encontrado(s):`)
                circulars.slice(0, 8).forEach((cycle, i) => {
                    console.log(`\n  [${i + 1}] ${cycle.join(' → ')} → (volta ao início)`)
                })
                if (circularCount > 8) {
                    console.log(`\n  ... e mais ${circularCount - 8} ciclos no relatório.`)
                }
                console.log(`\n📄 Relatório completo: ${reportFile}`)
            }
        } catch (e) {
            console.log('⚠️  Erro ao parsear resultado:', e.message)
        }
    }

    // Gerar grafo visual SVG se não houver muitos módulos
    try {
        execSync(
            `${cmd('madge')} --image "${imageFile}" ${tsFlag} "${entryDir}" 2>&1`,
            { stdio: 'pipe', timeout: 60000, shell: true, cwd: projectDir }
        )
        if (fs.existsSync(imageFile)) {
            console.log(`🖼️  Grafo visual gerado: ${imageFile}`)
            // Abrir no navegador
            const { spawnSync: sp } = require('child_process')
            sp('cmd', ['/c', 'start', '', imageFile], { shell: false })
        }
    } catch {
        // graphviz pode não estar instalado — não é obrigatório
    }

    return true
}

module.exports = { runMadge }
