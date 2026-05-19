const https = require('https')
const path = require('path')
const fs = require('fs')

const REPORTS_DIR = path.join(__dirname, '..', '..', 'reports')

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        const options = { 
            headers: { 'User-Agent': 'security-toolkit/1.0' },
            rejectUnauthorized: false
        }
        https.get(url, options, (res) => {
            let data = ''
            res.on('data', d => data += d)
            res.on('end', () => {
                try { resolve(JSON.parse(data)) }
                catch { resolve(null) }
            })
        }).on('error', reject)
    })
}

function httpsPost(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url)
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: { 'User-Agent': 'security-toolkit/1.0', 'Content-Length': 0 },
            rejectUnauthorized: false
        }
        const req = https.request(options, (res) => {
            let data = ''
            res.on('data', d => data += d)
            res.on('end', () => {
                try { resolve(JSON.parse(data)) }
                catch { resolve(null) }
            })
        })
        req.on('error', reject)
        req.end()
    })
}

async function runObservatory(url) {
    // Observatory só analisa URLs públicas — não funciona com localhost
    const urlObj = new URL(url)
    const isLocal = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1'

    const reportFile = path.join(REPORTS_DIR, `observatory-${urlObj.hostname.replace(/\./g, '-')}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`)

    console.log('\n🔭 [MOZILLA OBSERVATORY] Verificando headers de segurança HTTP...')

    if (isLocal) {
        console.log('   ⚠️  O Observatory analisa apenas URLs públicas (não localhost).')
        console.log('   👉 Configure uma URL de produção válida na GUI para rodar esta ferramenta.')
        console.log('   ⏭️  Pulando Observatory.\n')
        return true
    }

    const host = urlObj.hostname
    console.log(`   Host : ${host}`)
    console.log('   ⏳ Solicitando análise...')

    try {
        // Disparar nova análise
        await httpsPost(`https://observatory-api.mdn.mozilla.net/api/v2/analyze?host=${host}`)

        // Aguardar resultado (polling)
        let data = null
        let attempts = 0
        while (attempts < 12) {
            await new Promise(r => setTimeout(r, 5000))
            data = await httpsGet(`https://observatory-api.mdn.mozilla.net/api/v2/analyze?host=${host}`)
            if (data?.scan?.state === 'FINISHED') break
            process.stdout.write('.')
            attempts++
        }
        console.log()

        if (!data?.scan) {
            console.log('⚠️  Não foi possível obter resultado do Observatory.')
            return false
        }

        fs.writeFileSync(reportFile, JSON.stringify(data, null, 2))

        const scan = data.scan
        const tests = data.tests || {}
        const gradeIcon = { 'A+': '🟢', A: '🟢', B: '🟡', C: '🟡', D: '🔴', F: '🔴' }

        console.log('\n📊 Resultados:')
        console.log(`   ${gradeIcon[scan.grade] || '⚪'} Grade  : ${scan.grade || 'N/A'}`)
        console.log(`   Pontuação : ${scan.score ?? 'N/A'}/100`)

        // Mostrar testes que falharam
        const failed = Object.entries(tests)
            .filter(([, t]) => t.pass === false)
            .sort((a, b) => (a[1].score_modifier || 0) - (b[1].score_modifier || 0))

        if (failed.length > 0) {
            console.log('\n❌ Headers/configurações com problema:')
            failed.forEach(([name, t]) => {
                const penalty = t.score_modifier < 0 ? ` (${t.score_modifier} pts)` : ''
                console.log(`   • ${name}${penalty}`)
                if (t.recommendation) console.log(`     → ${t.recommendation}`)
            })
        } else {
            console.log('\n✅ Todos os headers de segurança estão configurados corretamente!')
        }

        console.log(`\n📄 Relatório completo: ${reportFile}`)
        console.log(`🌐 Ver online: https://observatory.mozilla.org/analyze/${host}`)
    } catch (e) {
        console.log('⚠️  Erro ao acessar Mozilla Observatory:', e.message)
        console.log('   Verifique se a URL está acessível publicamente.')
        return false
    }

    return true
}

module.exports = { runObservatory }
