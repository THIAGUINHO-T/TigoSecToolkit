const { execSync, spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const TOOLKIT_DIR = path.join(__dirname, '..')
const K6 = path.join(TOOLKIT_DIR, 'tools', 'k6.exe')
const REPORTS_DIR = path.join(__dirname, '..', '..', 'reports')

// Gera script k6 adaptado ao tipo de projeto
function generateK6Script(url, profile) {
    const scenarios = {
        light: { vus: 10, duration: '30s', label: 'Leve (10 usuários / 30s)' },
        medium: { vus: 50, duration: '60s', label: 'Médio (50 usuários / 60s)' },
        heavy: { vus: 200, duration: '120s', label: 'Pesado (200 usuários / 2min)' },
    }
    const s = scenarios[profile] || scenarios.light

    return {
        label: s.label,
        script: `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
    vus: ${s.vus},
    duration: '${s.duration}',
    thresholds: {
        http_req_duration: ['p(95)<2000'],  // 95% das req em menos de 2s
        http_req_failed:   ['rate<0.05'],    // menos de 5% de erros
        errors:            ['rate<0.05'],
    },
};

const BASE_URL = '${url}';

export default function () {
    // Página inicial
    const home = http.get(BASE_URL);
    check(home, { 'home status 200': (r) => r.status === 200 });
    errorRate.add(home.status !== 200);

    sleep(Math.random() * 2 + 0.5);
}
`
    }
}

async function runK6(projectDir, url) {
    const projectName = path.basename(projectDir)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const reportFile = path.join(REPORTS_DIR, `k6-${projectName}-${timestamp}.json`)
    const scriptFile = path.join(REPORTS_DIR, `k6-script-${timestamp}.js`)

    console.log('\n⚡ [K6] Teste de carga — simulando usuários simultâneos...')
    console.log(`   URL : ${url}`)

    if (!fs.existsSync(K6)) {
        console.error('❌ k6.exe não encontrado em tools/')
        return false
    }

    // Perfil fixo para GUI (Leve - 1)
    const profile = 'light'
    const { label, script } = generateK6Script(url, profile)

    fs.writeFileSync(scriptFile, script)
    console.log(`\n   Perfil : ${label}`)
    console.log('   ⏳ Executando teste de carga...\n')

    try {
        execSync(
            `"${K6}" run --insecure-skip-tls-verify --out json="${reportFile}" "${scriptFile}"`,
            { stdio: 'inherit', timeout: 300000 }
        )
    } catch {
        // k6 retorna exit 99 quando thresholds falham
    }

    // Limpar script temporário
    try { fs.unlinkSync(scriptFile) } catch {}

    if (fs.existsSync(reportFile)) {
        try {
            const lines = fs.readFileSync(reportFile, 'utf8').split('\n').filter(l => l.trim())
            const metrics = {}
            lines.forEach(l => {
                try {
                    const entry = JSON.parse(l)
                    if (entry.type === 'Point' && entry.metric) {
                        if (!metrics[entry.metric]) metrics[entry.metric] = []
                        metrics[entry.metric].push(entry.data?.value || 0)
                    }
                } catch {}
            })

            const avg = (arr) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(0) : 'N/A'
            const p95 = (arr) => {
                if (!arr.length) return 'N/A'
                const sorted = [...arr].sort((a, b) => a - b)
                return sorted[Math.floor(sorted.length * 0.95)].toFixed(0)
            }
            const max = (arr) => arr.length ? Math.max(...arr).toFixed(0) : 'N/A'

            const durations = metrics['http_req_duration'] || []
            const failures = metrics['http_req_failed'] || []
            const reqs = metrics['http_reqs'] || []
            const failRate = failures.length
                ? ((failures.filter(v => v > 0).length / failures.length) * 100).toFixed(1)
                : '0.0'

            console.log('\n📊 Resultados do teste de carga:')
            console.log(`   Total de requisições : ${reqs.length}`)
            console.log(`   Taxa de erros        : ${failRate}% ${parseFloat(failRate) < 5 ? '✅' : '❌'}`)
            console.log(`   Tempo médio          : ${avg(durations)}ms`)
            console.log(`   P95 (95% das req)    : ${p95(durations)}ms ${parseInt(p95(durations)) < 2000 ? '✅' : '❌'}`)
            console.log(`   Tempo máximo         : ${max(durations)}ms`)

            if (parseFloat(failRate) >= 5) {
                console.log('\n⚠️  Taxa de erros acima de 5% — o servidor pode estar com problemas de capacidade.')
            }
            if (parseInt(p95(durations)) >= 2000) {
                console.log('⚠️  P95 acima de 2 segundos — 5% dos usuários esperam mais de 2s.')
            }

            console.log(`\n📄 Relatório completo: ${reportFile}`)
        } catch (e) {
            console.log('⚠️  Erro ao parsear resultado:', e.message)
        }
    }

    return true
}

module.exports = { runK6 }
