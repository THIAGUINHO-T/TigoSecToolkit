const { execSync, spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const { cmd } = require('./which-cmd')

const REPORTS_DIR = path.join(__dirname, '..', '..', 'reports')

function runSnyk(projectDir) {
    const projectName = path.basename(projectDir)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const reportFile = path.join(REPORTS_DIR, `snyk-${projectName}-${timestamp}.json`)

    console.log('\n🛡️  [SNYK] Verificando vulnerabilidades nas dependências...')
    console.log(`   Projeto: ${projectDir}`)

    const check = spawnSync('"' + cmd('snyk') + '" --version', { encoding: 'utf8', shell: true })
    if (check.error || check.status !== 0) {
        console.error('❌ snyk não encontrado. Execute analisar.bat para realizar o setup local.')
        return false
    }

    // Verificar autenticação
    const authCheck = spawnSync('"' + cmd('snyk') + '" whoami', { encoding: 'utf8', shell: true })
    const authOutput = authCheck.stdout + authCheck.stderr
    const isUnauthenticated =
        authCheck.status !== 0 ||
        authOutput.includes('not authenticated') ||
        authOutput.includes('unauthenticated') ||
        authOutput.includes('Use `snyk auth`') ||
        authOutput.includes('snyk auth')

    if (isUnauthenticated) {
        console.log('\n⚠️  Snyk não está autenticado.')
        console.log('   Abrindo navegador para login gratuito em https://snyk.io ...\n')

        // Abre snyk auth que lança o browser e aguarda o callback
        const authResult = spawnSync('"' + cmd('snyk') + '" auth', {
            encoding: 'utf8',
            shell: true,
            stdio: 'inherit',  // exibe output em tempo real no terminal
            timeout: 120000,   // 2 minutos para o usuário logar
        })

        if (authResult.status !== 0) {
            console.log('\n❌ Autenticação cancelada ou falhou. Pulando Snyk.\n')
            return false
        }

        console.log('\n✅ Snyk autenticado com sucesso!\n')
    }

    const hasPackageJson = fs.existsSync(path.join(projectDir, 'package.json'))
    const hasPyreqs     = fs.existsSync(path.join(projectDir, 'requirements.txt'))
    const hasComposer   = fs.existsSync(path.join(projectDir, 'composer.json'))

    if (!hasPackageJson && !hasPyreqs && !hasComposer) {
        console.log('⚠️  Nenhum arquivo de dependências reconhecido (package.json, requirements.txt, composer.json). Pulando.')
        return true
    }

    try {
        execSync(
            `${cmd('snyk')} test --json --all-projects "${projectDir}" > "${reportFile}" 2>&1`,
            { stdio: 'pipe', cwd: projectDir, timeout: 120000, shell: true }
        )
        console.log('✅ Nenhuma vulnerabilidade crítica encontrada!')
    } catch (e) {
        // status 1 = vulns encontradas (normal)
    }

    if (fs.existsSync(reportFile)) {
        try {
            const raw = fs.readFileSync(reportFile, 'utf8')
            // snyk pode retornar array ou objeto
            let data
            try { data = JSON.parse(raw) } catch { data = null }

            if (!data) {
                console.log('⚠️  Não foi possível parsear resultado do snyk.')
                return false
            }

            const projects = Array.isArray(data) ? data : [data]
            let totalHigh = 0, totalMedium = 0, totalLow = 0

            projects.forEach(proj => {
                const vulns = proj.vulnerabilities || []
                vulns.forEach(v => {
                    if (v.severity === 'high' || v.severity === 'critical') totalHigh++
                    else if (v.severity === 'medium') totalMedium++
                    else totalLow++
                })
            })

            const total = totalHigh + totalMedium + totalLow
            if (total === 0) {
                console.log('✅ Nenhuma vulnerabilidade encontrada!')
            } else {
                console.log(`\n⚠️  ${total} vulnerabilidade(s) encontrada(s):`)
                console.log(`   🔴 Alta/Crítica : ${totalHigh}`)
                console.log(`   🟡 Média        : ${totalMedium}`)
                console.log(`   🔵 Baixa        : ${totalLow}`)

                // Mostrar as mais críticas
                const allVulns = projects.flatMap(p => p.vulnerabilities || [])
                    .sort((a, b) => {
                        const order = { critical: 0, high: 1, medium: 2, low: 3 }
                        return (order[a.severity] || 3) - (order[b.severity] || 3)
                    })
                    .slice(0, 8)

                console.log()
                allVulns.forEach((v, i) => {
                    console.log(`  [${i + 1}] ${v.severity?.toUpperCase()} — ${v.title}`)
                    console.log(`       Pacote  : ${v.packageName}@${v.version}`)
                    console.log(`       Fix     : ${v.fixedIn?.join(', ') || 'sem fix disponível'}`)
                    console.log()
                })

                console.log(`📄 Relatório completo: ${reportFile}`)
            }
        } catch (e) {
            console.log('⚠️  Erro ao processar relatório:', e.message)
        }
    }

    return true
}

module.exports = { runSnyk }
