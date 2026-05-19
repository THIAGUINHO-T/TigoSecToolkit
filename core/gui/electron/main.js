const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const fs = require('fs')

// Ignorar erros de certificado SSL (comum em ambientes corporativos/proxies)
// Isso resolve o erro "unable to get local issuer certificate" ao baixar ferramentas
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// Quando empacotado pelo electron-builder, __dirname aponta para dentro do
// app.asar (resources/app.asar/electron). Nesse caso, o "core/" real está
// 3 niveis acima do .exe: win-unpacked/ -> release/ -> gui/ -> core/.
// Em dev, __dirname e core/gui/electron e core/ esta 2 niveis acima.
const ROOT_DIR = app.isPackaged
  ? path.resolve(path.dirname(app.getPath('exe')), '..', '..', '..')
  : path.join(__dirname, '..', '..')
const DIST_INDEX = path.join(__dirname, '..', 'dist', 'index.html')
// "Dev" = nao ha build do Vite ainda; assume servidor em localhost:5173.
// "Prod" = carrega o dist/index.html (caso normal apos `npm run build`).
const isDev = !app.isPackaged
const SCRIPTS_DIR = path.join(ROOT_DIR, 'scripts')
const TOOLS_DIR = path.join(ROOT_DIR, 'tools')
// Scripts salvam em <project-root>/reports (irmao de core/), nao em core/reports.
const REPORTS_DIR = path.join(ROOT_DIR, '..', 'reports')

// Configurar PATH local para encontrar ferramentas portáteis
const IS_WIN = process.platform === 'win32'
const localBins = [
  path.join(ROOT_DIR, 'node_modules', '.bin'),
  path.join(ROOT_DIR, 'venv', IS_WIN ? 'Scripts' : 'bin'),
  TOOLS_DIR
]
process.env.PATH = localBins.join(path.delimiter) + path.delimiter + process.env.PATH

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 900,
    resizable: true,
    maximizable: true,
    frame: false,
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '../icon.png'),
    titleBarOverlay: {
      color: '#06060e',
      symbolColor: '#00f0ff',
      height: 36,
    },
    backgroundColor: '#06060e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

// --- IPC: Dialogos ---

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Selecionar projeto para analise',
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

// --- IPC: Deteccao de Projeto ---

ipcMain.handle('detect-project', (_event, projectDir) => {
  try {
    const { detectProject } = require(path.join(SCRIPTS_DIR, 'detect-project'))
    return detectProject(projectDir)
  } catch (e) {
    return { error: e.message }
  }
})

// --- IPC: Verificar Ferramentas ---

ipcMain.handle('check-tools', () => {
  const checkBin = (exe) => fs.existsSync(path.join(TOOLS_DIR, exe))
  const checkNpm = (name) => {
    const binPath = path.join(ROOT_DIR, 'node_modules', '.bin', IS_WIN ? name + '.cmd' : name)
    return fs.existsSync(binPath)
  }
  const checkVenv = (name) => {
    const exePath = path.join(ROOT_DIR, 'venv', IS_WIN ? 'Scripts' : 'bin', IS_WIN ? name + '.exe' : name)
    return fs.existsSync(exePath)
  }

  return {
    gitleaks:    checkBin('gitleaks.exe'),
    trufflehog:  checkBin('trufflehog.exe'),
    semgrep:     checkVenv('semgrep'),
    depcheck:    checkNpm('depcheck'),
    madge:       checkNpm('madge'),
    snyk:        checkNpm('snyk'),
    nuclei:      checkBin('nuclei.exe'),
    lighthouse:  checkNpm('lighthouse'),
    observatory: true,
    k6:          checkBin('k6.exe'),
  }
})

// --- IPC: Snyk Auth ---

// Snyk vem como .cmd no Windows. Para nao precisar de shell:true (que gera
// DeprecationWarning no Node 22+), invocamos o JS do snyk diretamente via node.
function runSnyk(args, timeoutMs) {
  const snykJs = path.join(ROOT_DIR, 'node_modules', 'snyk', 'dist', 'cli', 'index.js')
  if (fs.existsSync(snykJs)) {
    return spawnSync(process.execPath, [snykJs, ...args], {
      encoding: 'utf8', stdio: 'pipe', timeout: timeoutMs,
      env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }),
    })
  }
  return spawnSync(
    path.join(ROOT_DIR, 'node_modules', '.bin', IS_WIN ? 'snyk.cmd' : 'snyk'),
    args,
    { encoding: 'utf8', stdio: 'pipe', timeout: timeoutMs }
  )
}

ipcMain.handle('snyk-auth', () => {
  const result = runSnyk(['auth'], 120000)
  return { success: result.status === 0, output: (result.stdout || '') + (result.stderr || '') }
})

ipcMain.handle('snyk-status', () => {
  const result = runSnyk(['whoami'], 10000)
  const output = (result.stdout || '') + (result.stderr || '')
  const authenticated = result.status === 0 && !output.toLowerCase().includes('unauthenticated')
  return { authenticated, user: authenticated ? (result.stdout || '').trim() : null }
})

// --- IPC: Executar Scan ---

let activeScan = null

ipcMain.on('start-scan', (event, { tools, projectDir, url }) => {
  if (activeScan) {
    event.sender.send('scan-error', { message: 'Um scan ja esta em andamento.' })
    return
  }

  const sender = event.sender
  activeScan = { aborted: false }

  const runNext = async (index) => {
    if (index >= tools.length || activeScan.aborted) {
      sender.send('scan-complete', { aborted: activeScan.aborted })
      activeScan = null
      return
    }

    const toolId = tools[index]
    sender.send('tool-start', { toolId, index, total: tools.length })

    try {
      const result = await runSingleTool(sender, toolId, projectDir, url)
      sender.send('tool-complete', { toolId, success: result, index })
    } catch (e) {
      sender.send('tool-complete', { toolId, success: false, error: e.message, index })
    }

    runNext(index + 1)
  }

  runNext(0)
})

ipcMain.on('abort-scan', () => {
  if (activeScan) activeScan.aborted = true
})

function runSingleTool(sender, toolId, projectDir, url) {
  return new Promise((resolve) => {
    const runnerScript = path.join(__dirname, 'tool-runner.js')
    const args = [runnerScript, toolId, projectDir]
    if (url) args.push(url)

    // Usa o Electron embutido como runtime Node (funciona em dev e em prod empacotado).
    const child = spawn(process.execPath, args, {
      cwd: ROOT_DIR,
      env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }),
    })

    let result = true

    child.stdout.on('data', (data) => {
      const text = data.toString()
      if (text.includes('__RESULT__:false')) result = false
      const clean = text.replace(/__RESULT__:(true|false)/g, '').trim()
      if (clean) sender.send('scan-log', { toolId, line: clean, stream: 'stdout' })
    })

    child.stderr.on('data', (data) => {
      sender.send('scan-log', { toolId, line: data.toString(), stream: 'stderr' })
    })

    child.on('close', (code) => {
      resolve(code === 0 && result)
    })

    child.on('error', () => resolve(false))
  })
}

// --- IPC: Setup ---

ipcMain.handle('run-setup', (event, toolId) => {
  return new Promise((resolve) => {
    // Em prod empacotado, setup.js está em extraResources; em dev, está em scripts/.
    const setupCandidates = [
      path.join(process.resourcesPath || '', 'setup.js'),
      path.join(SCRIPTS_DIR, 'setup.js'),
    ]
    const setupPath = setupCandidates.find(p => fs.existsSync(p)) || setupCandidates[1]
    
    const args = [setupPath]
    if (toolId) {
      args.push(toolId)
    }

    const child = spawn(process.execPath, args, {
      cwd: ROOT_DIR,
      env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }),
    })

    child.stdout.on('data', (data) => {
      event.sender.send('setup-log', data.toString())
    })
    child.stderr.on('data', (data) => {
      event.sender.send('setup-log', data.toString())
    })
    child.on('close', (code) => resolve(code === 0))
    child.on('error', () => resolve(false))
  })
})

ipcMain.handle('update-titlebar-theme', (_event, themeName) => {
  if (!mainWindow || typeof mainWindow.setTitleBarOverlay !== 'function') return false
  let symbolColor = '#00f0ff'
  let bgColor = '#06060e'
  
  if (themeName === 'green') {
    symbolColor = '#00e676'
  } else if (themeName === 'purple') {
    symbolColor = '#e040fb'
  } else if (themeName === 'candy') {
    symbolColor = '#ff80ab'
    bgColor = '#25150d'
  }
  
  try {
    mainWindow.setTitleBarOverlay({
      color: bgColor,
      symbolColor: symbolColor,
      height: 36
    })
    return true
  } catch (e) {
    console.error('Erro ao atualizar a barra de titulo:', e)
    return false
  }
})

// --- IPC: Relatorios ---

ipcMain.handle('list-reports', () => {
  if (!fs.existsSync(REPORTS_DIR)) return []

  const toolCategories = {
    gitleaks:    'Secrets & Credenciais',
    trufflehog:  'Secrets & Credenciais',
    semgrep:     'Codigo-fonte',
    depcheck:    'Codigo-fonte',
    madge:       'Codigo-fonte',
    snyk:        'Dependencias & CVEs',
    nuclei:      'Dependencias & CVEs',
    lighthouse:  'Frontend & HTTP',
    observatory: 'Frontend & HTTP',
    k6:          'Carga & Estabilidade',
  }

  const MIN_SIZE = 1024 // ignorar arquivos menores que 1KB (relatórios vazios/inúteis)

  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('.json') || f.endsWith('.html') || f.endsWith('.svg'))
    .filter(f => !(f.startsWith('lighthouse') && f.endsWith('.json'))) // Oculta o JSON do Lighthouse (já exibimos o HTML)
    .map(f => {
      const stat = fs.statSync(path.join(REPORTS_DIR, f))
      const tool = f.split('-')[0]
      const category = toolCategories[tool] || 'Outros'
      
      let summary = null
      try {
        if (tool === 'lighthouse' && f.endsWith('.html')) {
          const jsonFile = path.join(REPORTS_DIR, f.replace('.html', '.json'))
          if (fs.existsSync(jsonFile)) {
            const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'))
            const cats = data.categories || {}
            summary = {
              performance: cats.performance ? Math.round(cats.performance.score * 100) : 0,
              accessibility: cats.accessibility ? Math.round(cats.accessibility.score * 100) : 0,
              bestPractices: cats['best-practices'] ? Math.round(cats['best-practices'].score * 100) : 0,
              seo: cats.seo ? Math.round(cats.seo.score * 100) : 0
            }
          }
        } else if (tool === 'observatory' && f.endsWith('.json')) {
          const data = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), 'utf8'))
          if (data.scan) summary = { grade: data.scan.grade, score: data.scan.score }
        } else if (tool === 'depcheck' && f.endsWith('.json')) {
          const data = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), 'utf8'))
          summary = { unused: (data.dependencies || []).length, dev: (data.devDependencies || []).length, missing: Object.keys(data.missing || {}).length }
        } else if (tool === 'k6' && f.endsWith('.json')) {
          const data = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), 'utf8'))
          const metrics = data.metrics || {}
          summary = {
            reqs: metrics.http_reqs?.values?.count || 0,
            errors: metrics.http_req_failed?.values?.rate ? (metrics.http_req_failed.values.rate * 100).toFixed(1) : 0,
            vus: metrics.vus_max?.values?.value || 0
          }
        } else if (tool === 'snyk' && f.endsWith('.json')) {
          const data = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), 'utf8'))
          const arr = Array.isArray(data) ? data : [data]
          const vulns = arr.flatMap(a => a.vulnerabilities || [])
          summary = { total: vulns.length, high: vulns.filter(v => v.severity === 'high').length, critical: vulns.filter(v => v.severity === 'critical').length }
        } else if (tool === 'semgrep' && f.endsWith('.json')) {
          const data = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), 'utf8'))
          const results = data.results || []
          summary = { total: results.length, error: results.filter(r => r.extra?.severity === 'ERROR').length, warning: results.filter(r => r.extra?.severity === 'WARNING').length }
        } else if (tool === 'trufflehog' && f.endsWith('.json')) {
          const raw = fs.readFileSync(path.join(REPORTS_DIR, f), 'utf8')
          const lines = raw.split('\n').filter(Boolean)
          const verified = lines.filter(l => l.includes('"Verified": true')).length
          summary = { total: lines.length, verified }
        } else if (tool === 'gitleaks' && f.endsWith('.json')) {
          const data = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), 'utf8'))
          summary = { total: Array.isArray(data) ? data.length : 0 }
        }
      } catch (e) {
        // Ignora erros de parsing
      }
      
      return { name: f, tool, category, size: stat.size, modified: stat.mtime.toISOString(), path: path.join(REPORTS_DIR, f), summary }
    })
    .filter(f => f.size >= MIN_SIZE)
    .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
  return files
})

ipcMain.handle('delete-all-reports', () => {
  if (!fs.existsSync(REPORTS_DIR)) return true
  try {
    const files = fs.readdirSync(REPORTS_DIR)
    for (const file of files) {
      if (file !== '.gitkeep') {
        fs.unlinkSync(path.join(REPORTS_DIR, file))
      }
    }
    return true
  } catch (err) {
    console.error('Erro ao excluir todos os relatorios:', err)
    return false
  }
})

ipcMain.handle('delete-old-reports', () => {
  if (!fs.existsSync(REPORTS_DIR)) return true
  try {
    const now = Date.now()
    const ONE_DAY = 24 * 60 * 60 * 1000
    const files = fs.readdirSync(REPORTS_DIR)
    
    for (const file of files) {
      if (file !== '.gitkeep') {
        const filePath = path.join(REPORTS_DIR, file)
        const stat = fs.statSync(filePath)
        if (now - stat.mtimeMs > ONE_DAY) {
          fs.unlinkSync(filePath)
        }
      }
    }
    return true
  } catch (err) {
    console.error('Erro ao excluir relatorios antigos:', err)
    return false
  }
})

ipcMain.handle('export-reports-markdown', async (_event, paths) => {
  let md = '# 🛡️ Relatório Consolidado de Segurança e Qualidade\n\n'
  md += '> Resumo gerado pelo TigoSecToolkit para análise de IA.\n\n'

  for (const filePath of paths) {
    if (!fs.existsSync(filePath)) continue
    
    const filename = path.basename(filePath)
    const tool = filename.split('-')[0].toLowerCase()
    
    // Para Lighthouse, se o arquivo for HTML, tentamos ler o JSON equivalente para extrair dados
    let targetPath = filePath
    if (tool === 'lighthouse' && filePath.endsWith('.html')) {
      const jsonCandidate = filePath.replace('.report.html', '.report.json')
      if (fs.existsSync(jsonCandidate)) targetPath = jsonCandidate
    }

    const content = fs.readFileSync(targetPath, 'utf8')
    md += `---\n\n## 🛠️ ${tool.toUpperCase()} (${path.basename(targetPath)})\n\n`
    
    try {
      if (tool === 'snyk' && targetPath.endsWith('.json')) {
        const data = JSON.parse(content)
        const arr = Array.isArray(data) ? data : [data]
        const vulns = arr.flatMap(a => a.vulnerabilities || [])
        if (vulns.length === 0) {
          md += '✅ Nenhuma vulnerabilidade encontrada.\n\n'
          continue
        }
        md += `⚠️ **${vulns.length} Vulnerabilidades Encontradas:**\n\n`
        vulns.forEach(v => {
          md += `- **[${v.severity.toUpperCase()}]** \`${v.packageName}\` (${v.version})\n`
          md += `  - Título: ${v.title}\n`
          if (v.fixedIn && v.fixedIn.length > 0) md += `  - Correção: Atualizar para \`${v.fixedIn.join(', ')}\`\n`
        })
        md += '\n'
      }
      
      else if (tool === 'semgrep' && filePath.endsWith('.json')) {
        const data = JSON.parse(content)
        const results = data.results || []
        if (results.length === 0) {
          md += '✅ Nenhum problema encontrado no código.\n\n'
          continue
        }
        md += `⚠️ **${results.length} Problemas Encontrados:**\n\n`
        results.forEach(r => {
          md += `- **[${r.extra?.severity || 'WARNING'}]** Arquivo: \`${r.path}:${r.start?.line}\`\n`
          md += `  - Regra: \`${r.check_id}\`\n`
          md += `  - Detalhe: ${r.extra?.message}\n`
        })
        md += '\n'
      }
      
      else if (tool === 'depcheck' && filePath.endsWith('.json')) {
        const data = JSON.parse(content)
        const unused = data.dependencies || []
        const unusedDev = data.devDependencies || []
        if (unused.length === 0 && unusedDev.length === 0) {
          md += '✅ Nenhuma dependência não utilizada encontrada.\n\n'
          continue
        }
        if (unused.length > 0) {
          md += `📦 **Dependências não utilizadas (${unused.length}):**\n`
          unused.forEach(d => md += `- \`${d}\`\n`)
          md += '\n'
        }
        if (unusedDev.length > 0) {
          md += `🔧 **DevDependencies não utilizadas (${unusedDev.length}):**\n`
          unusedDev.forEach(d => md += `- \`${d}\`\n`)
          md += '\n'
        }
      }
      
      else if (tool === 'trufflehog' && targetPath.endsWith('.json')) {
        const lines = content.split('\n').filter(Boolean)
        if (lines.length === 0) {
          md += '✅ Nenhum segredo exposto encontrado.\n\n'
          continue
        }
        
        let validSecrets = 0
        lines.forEach(l => {
          try {
            const secret = JSON.parse(l)
            const detector = secret.DetectorName || secret.detector_name || secret.detectorName
            const raw = secret.Raw || secret.raw || secret.RawEndpoint
            
            // Trufflehog emite logs de meta-dados que não são segredos. Filtramos aqui.
            if (!detector || !raw || detector === 'Desconhecido') return
            
            const verified = secret.Verified || secret.verified || false
            const file = secret.SourceMetadata?.Data?.Git?.file || secret.SourceMetadata?.Data?.Filesystem?.file || secret.path || 'Desconhecido'
            
            md += `- **Detector:** \`${detector}\` | **Verificado:** ${verified ? 'Sim 🔴' : 'Não 🟡'}\n`
            md += `  - Arquivo: \`${file}\`\n`
            md += `  - Trecho: \`${raw.substring(0, 100)}${raw.length > 100 ? '...' : ''}\`\n`
            validSecrets++
          } catch {}
        })
        if (validSecrets === 0) md += '*(Formato de log não reconhecido ou vazio)*\n\n'
        else md += `\n🚨 **${validSecrets} Segredos Encontrados.**\n\n`
      }
      
      else if (tool === 'lighthouse' && targetPath.endsWith('.json')) {
        const data = JSON.parse(content)
        const cats = data.categories || {}
        const audits = data.audits || {}
        md += `📊 **Scores:**\n`
        md += `- Performance: ${cats.performance ? Math.round(cats.performance.score * 100) : 0}/100\n`
        md += `- Acessibilidade: ${cats.accessibility ? Math.round(cats.accessibility.score * 100) : 0}/100\n`
        md += `- Boas Práticas: ${cats['best-practices'] ? Math.round(cats['best-practices'].score * 100) : 0}/100\n`
        md += `- SEO: ${cats.seo ? Math.round(cats.seo.score * 100) : 0}/100\n\n`
        
        const failedSecurity = ['uses-https', 'no-vulnerable-libraries', 'csp-xss', 'geolocation-on-start', 'notification-on-start'].filter(id => audits[id] && audits[id].score !== null && audits[id].score < 1)
        if (failedSecurity.length > 0) {
          md += `⚠️ **Alertas de Segurança:**\n`
          failedSecurity.forEach(id => md += `- ${audits[id].title}\n`)
          md += '\n'
        }
        
        const opps = Object.values(audits).filter(a => a.details?.type === 'opportunity' && a.score !== null && a.score < 1).sort((a, b) => (a.score || 0) - (b.score || 0)).slice(0, 3)
        if (opps.length > 0) {
          md += `⚡ **Principais Gargalos de Performance:**\n`
          opps.forEach(o => md += `- ${o.title}\n`)
          md += '\n'
        }
      }
      
      else if (tool === 'observatory' && filePath.endsWith('.json')) {
        const data = JSON.parse(content)
        if (data.scan) {
          md += `📊 **Nota Final:** ${data.scan.grade} (${data.scan.score}/100)\n\n`
        }
        if (data.tests) {
          const failed = Object.values(data.tests).filter(t => t.pass === false)
          if (failed.length > 0) {
            md += `❌ **Falhas de Segurança HTTP:**\n`
            failed.forEach(t => md += `- ${t.title} (${t.score_modifier} pts)\n`)
          } else {
            md += `✅ Nenhum header obrigatório faltando.\n`
          }
          md += '\n'
        }
      }
      
      else if (tool === 'k6' && targetPath.endsWith('.json')) {
        // K6 gera NDJSON (um JSON por linha). Vamos extrair as métricas principais.
        const lines = content.split('\n').filter(Boolean)
        const metrics = {}
        
        lines.forEach(line => {
          try {
            const entry = JSON.parse(line)
            if (entry.type === 'Point' && entry.metric) {
              if (!metrics[entry.metric]) metrics[entry.metric] = []
              metrics[entry.metric].push(entry.data?.value || 0)
            }
          } catch {}
        })

        if (Object.keys(metrics).length > 0) {
          const avg = (arr) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(0) : '0'
          
          const durations = metrics['http_req_duration'] || []
          const failures = metrics['http_req_failed'] || []
          const reqs = metrics['http_reqs'] || []
          const failRate = failures.length
              ? ((failures.filter((v) => v > 0).length / failures.length) * 100).toFixed(1)
              : '0.0'

          md += `📈 **Resultado do Teste de Carga:**\n`
          md += `- Total Requests: ${reqs.length}\n`
          md += `- Taxa de Erro: ${failRate}%\n`
          md += `- Tempo Médio: ${avg(durations)}ms\n`
          md += `- Status: ${parseFloat(failRate) < 5 ? '✅ Estável' : '❌ Instável'}\n\n`
        } else {
          md += '⚠️ Não foi possível extrair métricas do arquivo NDJSON do K6.\n\n'
        }
      }
      
      else {
        md += `*(Sem parser de problemas detalhado para esta ferramenta. Acesse o JSON para visualizar.*)\n\n`
      }
      
    } catch (e) {
      md += `⚠️ Erro ao extrair problemas: ${e.message}\n\n`
    }
  }

  return md
})

ipcMain.handle('read-report', (_event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    if (filePath.endsWith('.json')) {
      try {
        // Tenta parse normal
        return { type: 'json', data: JSON.parse(content) }
      } catch (parseError) {
        // Se falhar, pode ser JSON Lines (ex: output do k6)
        try {
          const lines = content.trim().split('\n')
            .filter(l => l.trim())
            .map(l => JSON.parse(l))
          return { type: 'json', data: lines }
        } catch (e) {
          throw parseError // lança o erro original se não for JSONL
        }
      }
    }
    return { type: 'html', data: content }
  } catch (e) {
    return { type: 'error', data: e.message }
  }
})

ipcMain.handle('open-report-file', (_event, filePath) => {
  shell.openPath(filePath)
})

// --- App Lifecycle ---

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
