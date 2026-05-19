import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, FolderOpen, Play, Square, Settings, FileText, LayoutDashboard, ChevronRight, CheckCircle2, XCircle, Loader2, Info, ExternalLink, Clock, Trash2, Search, Bot, Filter, Lock, Package, Code, Globe, Activity, Palette } from 'lucide-react'
import { TOOLS, TOOL_CATEGORIES } from './lib/tools-config'
import type { ProjectInfo, LogEntry, ToolResult as ToolResultType, ReportFile } from './types'
import TerminalViewer from './components/TerminalViewer'
import ScoreGauge from './components/ScoreGauge'
import ReportViewer from './components/ReportViewer'
import CandyDashboard from './components/CandyDashboard'

type View = 'scan' | 'reports' | 'settings'
type ScanStatus = 'idle' | 'running' | 'complete'

interface ToolStatus {
  [key: string]: 'pending' | 'running' | 'success' | 'failed'
}

const getToolColor = (tool: string) => {
  switch (tool) {
    case 'k6': return 'bg-purple-500/20 border-purple-500/30 text-purple-400'
    case 'observatory': return 'bg-blue-500/20 border-blue-500/30 text-blue-400'
    case 'lighthouse': return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
    case 'snyk': return 'bg-orange-500/20 border-orange-500/30 text-orange-400'
    case 'semgrep': return 'bg-teal-500/20 border-teal-500/30 text-teal-400'
    case 'depcheck': return 'bg-gray-400/20 border-gray-400/30 text-gray-300'
    case 'madge': return 'bg-pink-500/20 border-pink-500/30 text-pink-400'
    case 'gitleaks':
    case 'trufflehog': return 'bg-red-500/20 border-red-500/30 text-red-400'
    case 'nuclei': return 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
    default: return 'bg-cyber-cyan/20 border-cyber-cyan/30 text-cyber-cyan'
  }
}

const PRESETS = [
  { 
    id: 'all', 
    label: 'Scan Completo', 
    icon: Shield, 
    activeClass: 'border-cyber-cyan/40 bg-cyber-cyan/10 text-cyber-cyan shadow-[0_0_15px_rgba(0,240,255,0.15)]', 
    tools: ['gitleaks', 'trufflehog', 'semgrep', 'depcheck', 'madge', 'snyk', 'nuclei', 'lighthouse', 'observatory', 'k6'] 
  },
  { 
    id: 'secrets', 
    label: 'Apenas Segredos', 
    icon: Lock, 
    activeClass: 'border-cyber-red/40 bg-cyber-red/10 text-cyber-red shadow-[0_0_15px_rgba(255,23,68,0.15)]', 
    tools: ['gitleaks', 'trufflehog'] 
  },
  { 
    id: 'sast', 
    label: 'Qualidade & SAST', 
    icon: Code, 
    activeClass: 'border-cyber-violet/40 bg-cyber-violet/10 text-cyber-violet shadow-[0_0_15px_rgba(139,92,246,0.15)]', 
    tools: ['semgrep', 'depcheck', 'madge', 'snyk'] 
  },
  { 
    id: 'web', 
    label: 'Web & Carga', 
    icon: Globe, 
    activeClass: 'border-cyber-green/40 bg-cyber-green/10 text-cyber-green shadow-[0_0_15px_rgba(0,230,118,0.15)]', 
    tools: ['nuclei', 'lighthouse', 'observatory', 'k6'] 
  }
]

export default function App() {
  // ── Navigation ──
  const [view, setView] = useState<View>('scan')

  // ── Scan Config ──
  const [projectDir, setProjectDir] = useState('')
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set())
  const [scanUrl, setScanUrl] = useState('')

  // ── Tool Availability ──
  const [toolAvailability, setToolAvailability] = useState<Record<string, boolean>>({})

  // ── Scan State ──
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle')
  const [toolStatuses, setToolStatuses] = useState<ToolStatus>({})
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [currentTool, setCurrentTool] = useState('')

  // ── Reports ──
  const [reports, setReports] = useState<ReportFile[]>([])
  const [selectedReport, setSelectedReport] = useState<ReportFile | null>(null)
  const [reportFilter, setReportFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas')
  const [severityFilter, setSeverityFilter] = useState<string>('Todas')
  const [lastScanTime, setLastScanTime] = useState<number | null>(null)
  const [showLastScanOnly, setShowLastScanOnly] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // ── Theme State ──
  const [theme, setTheme] = useState<'cyan' | 'green' | 'purple' | 'candy'>(() => {
    return (localStorage.getItem('cyber-theme') as 'cyan' | 'green' | 'purple' | 'candy') || 'cyan'
  })

  const isPresetActive = useCallback((presetTools: string[]) => {
    if (selectedTools.size !== presetTools.length) return false
    return presetTools.every(id => selectedTools.has(id))
  }, [selectedTools])

  const handleApplyPreset = useCallback((toolIds: string[]) => {
    setSelectedTools(new Set(toolIds))
  }, [])

  const getReportSeverity = useCallback((report: ReportFile): 'critical' | 'high' | 'medium' | 'low' => {
    const tool = report.tool.toLowerCase()
    const summary = report.summary

    if (!summary) return 'low'

    switch (tool) {
      case 'gitleaks':
        return summary.total > 0 ? 'high' : 'low'
      case 'trufflehog':
        if (summary.verified > 0) return 'critical'
        return summary.total > 0 ? 'high' : 'low'
      case 'snyk':
        if (summary.critical > 0) return 'critical'
        if (summary.high > 0) return 'high'
        return summary.total > 0 ? 'medium' : 'low'
      case 'semgrep':
        if (summary.error > 0) return 'high'
        if (summary.warning > 0) return 'medium'
        return 'low'
      case 'lighthouse':
        const scores = [summary.performance, summary.accessibility, summary.bestPractices, summary.seo]
        if (scores.some(s => s < 50)) return 'high'
        if (scores.some(s => s < 90)) return 'medium'
        return 'low'
      case 'observatory':
        if (['F', 'D'].includes(summary.grade)) return 'high'
        if (['C', 'B'].includes(summary.grade)) return 'medium'
        return 'low'
      case 'depcheck':
        if (summary.missing > 0) return 'high'
        if (summary.unused > 0) return 'medium'
        return 'low'
      case 'k6':
        const errRate = parseFloat(summary.errors) || 0
        if (errRate > 5) return 'high'
        if (errRate > 0) return 'medium'
        return 'low'
      default:
        return 'low'
    }
  }, [])

  // Relatórios filtrados apenas por categoria e texto, servindo de base para os contadores de severidade
  const reportsByCategory = useMemo(() => {
    let list = reports

    if (showLastScanOnly && lastScanTime) {
      list = list.filter(r => new Date(r.modified).getTime() >= lastScanTime - 5000)
    }

    if (categoryFilter !== 'Todas') {
      list = list.filter(r => r.category === categoryFilter)
    }

    list = list.filter(r => {
      const search = reportFilter.toLowerCase()
      const name = r.name.toLowerCase()
      const tool = r.tool.toLowerCase()
      
      const words = search.split(/\s+/).filter(Boolean)
      if (words.length === 0) return true
      
      return words.every(word => name.includes(word) || tool.includes(word))
    })

    return list
  }, [reports, showLastScanOnly, lastScanTime, categoryFilter, reportFilter])

  // Relatórios finais filtrados por tudo, incluindo severidade
  const filteredReports = useMemo(() => {
    if (severityFilter === 'Todas') {
      return reportsByCategory
    }
    return reportsByCategory.filter(r => getReportSeverity(r) === severityFilter)
  }, [reportsByCategory, severityFilter, getReportSeverity])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }

  // ── Settings ──
  const [setupRunning, setSetupRunning] = useState<string | null>(null)
  const [setupLogs, setSetupLogs] = useState<string[]>([])
  const [snykStatus, setSnykStatus] = useState<{ authenticated: boolean; user: string | null }>({ authenticated: false, user: null })

  // Verificar ferramentas ao iniciar
  useEffect(() => {
    if (window.api) {
      window.api.checkTools().then(setToolAvailability)
      window.api.snykStatus().then(setSnykStatus).catch(() => {})
    }
  }, [])

  // Aplicar tema selecionado ao container principal
  useEffect(() => {
    const rootEl = document.getElementById('root')
    if (rootEl) {
      rootEl.className = `theme-${theme}`
    }
    localStorage.setItem('cyber-theme', theme)
    if (window.api && window.api.updateTitleBarTheme) {
      window.api.updateTitleBarTheme(theme).catch(() => {})
    }
  }, [theme])

  // Registrar listeners IPC
  useEffect(() => {
    if (!window.api) return

    const unsubs = [
      window.api.onScanLog((data) => setLogs(prev => [...prev, data])),
      window.api.onToolStart((data) => {
        setCurrentTool(data.toolId)
        setToolStatuses(prev => ({ ...prev, [data.toolId]: 'running' }))
      }),
      window.api.onToolComplete((data) => {
        setToolStatuses(prev => ({ ...prev, [data.toolId]: data.success ? 'success' : 'failed' }))
      }),
      window.api.onScanComplete(() => setScanStatus('complete')),
    ]

    return () => unsubs.forEach(fn => fn())
  }, [])

  // ── Handlers ──
  const handleSelectDir = async () => {
    const dir = await window.api.selectDirectory()
    if (dir) {
      setProjectDir(dir)
      const info = await window.api.detectProject(dir)
      setProjectInfo(info)
      if (info) {
        if (info.hasGit) {
          setSelectedTools(new Set(PRESETS.find(p => p.id === 'all')?.tools || []))
        } else {
          setSelectedTools(new Set(PRESETS.find(p => p.id === 'sast')?.tools || []))
        }
      }
    }
  }

  const handleToggleTool = (toolId: string) => {
    setSelectedTools(prev => {
      const next = new Set(prev)
      next.has(toolId) ? next.delete(toolId) : next.add(toolId)
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedTools.size === TOOLS.length) {
      setSelectedTools(new Set())
    } else {
      setSelectedTools(new Set(TOOLS.map(t => t.id)))
    }
  }

  const handleStartScan = () => {
    if (!projectDir || selectedTools.size === 0) return
    setLogs([])
    setToolStatuses(Object.fromEntries([...selectedTools].map(t => [t, 'pending'])))
    setScanStatus('running')
    setLastScanTime(Date.now())
    setShowLastScanOnly(false)
    window.api.startScan({
      tools: [...selectedTools],
      projectDir,
      url: scanUrl.trim() || undefined,
    })
  }

  const handleAbortScan = () => {
    window.api.abortScan()
    setScanStatus('idle')
  }

  const handleRunSetup = async (toolId?: string) => {
    const actualToolId = typeof toolId === 'string' ? toolId : undefined
    setSetupRunning(actualToolId || 'all')
    setSetupLogs([])
    const unsub = window.api.onSetupLog((line) => setSetupLogs(prev => [...prev, line]))
    await window.api.runSetup(actualToolId)
    unsub()
    setSetupRunning(null)
    window.api.checkTools().then(setToolAvailability)
  }

  const handleSnykAuth = async () => {
    await window.api.snykAuth()
    const status = await window.api.snykStatus()
    setSnykStatus(status)
  }

  const handleLoadReports = async () => {
    const list = await window.api.listReports()
    setReports(list)
  }

  const handleViewResults = () => {
    setShowLastScanOnly(true)
    setView('reports')
  }

  useEffect(() => { if (view === 'reports') handleLoadReports() }, [view])

  const hasUrl = scanUrl.trim().length > 0
  const urlToolNames = TOOLS.filter(t => t.needsUrl).map(t => t.name).join(', ')

  // ── Sidebar ──
  const navItems = [
    { id: 'scan' as View, icon: Shield, label: 'Scan' },
    { id: 'reports' as View, icon: FileText, label: 'Relatórios' },
    { id: 'settings' as View, icon: Settings, label: 'Configurações' },
  ]

  return (
    <div className={`theme-${theme} h-screen flex flex-col ${theme === 'candy' ? 'bg-[#25150d]' : 'bg-cyber-bg'} text-white`}>
      {/* Title Bar drag region */}
      <div className={`drag-region h-9 flex items-center px-4 ${theme === 'candy' ? 'bg-[#25150d] border-b border-[#3d2417]' : 'bg-cyber-bg border-b border-cyber-border/30'} shrink-0`}>
        <Shield className={`w-4 h-4 mr-2 no-drag ${theme === 'candy' ? 'text-[#ff80ab]' : 'text-cyber-cyan'}`} />
        <span className={`text-xs font-mono no-drag ${theme === 'candy' ? 'text-[#ff80ab]/80 font-bold' : 'text-cyber-muted'}`}>TIGO SEC TOOLKIT</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {theme === 'candy' ? (
          <CandyDashboard
            projectDir={projectDir}
            handleSelectDirectory={handleSelectDir}
            scanUrl={scanUrl}
            setScanUrl={setScanUrl}
            view={view}
            setView={setView}
            theme={theme}
            setTheme={setTheme}
            selectedTools={selectedTools}
            setSelectedTools={setSelectedTools}
            isPresetActive={isPresetActive}
            handleApplyPreset={handleApplyPreset}
            toolAvailability={toolAvailability}
            toolStatuses={toolStatuses}
            handleRunSetup={handleRunSetup}
            scanStatus={scanStatus}
            handleStartScan={handleStartScan}
            handleAbortScan={handleAbortScan}
            reportFilter={reportFilter}
            setReportFilter={setReportFilter}
            severityFilter={severityFilter}
            setSeverityFilter={setSeverityFilter}
            filteredReports={filteredReports}
            setSelectedReport={setSelectedReport}
            handleDeleteAllReports={async () => {
              const success = await window.api.deleteAllReports()
              if (success) {
                showToast("Todos os relatórios apagados!")
                handleLoadReports()
              }
            }}
            handleDeleteOldReports={async () => {
              const success = await window.api.deleteOldReports()
              if (success) {
                showToast("Relatórios com mais de 24h apagados!")
                handleLoadReports()
              }
            }}
            showToast={showToast}
            logs={logs}
          />
        ) : (
          <>
            {/* Sidebar */}
            <nav className="w-16 border-r border-cyber-border/30 flex flex-col items-center py-4 gap-2 shrink-0">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200 group relative
                ${view === item.id
                  ? 'bg-cyber-cyan/10 text-cyber-cyan shadow-glow-cyan'
                  : 'text-cyber-muted hover:text-white hover:bg-white/5'}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium bg-cyber-card border border-cyber-border rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {view === 'scan' && (
              <motion.div key="scan" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-6xl mx-auto">
                {/* Header */}
                <div>
                  <h1 className="text-2xl font-semibold flex items-center gap-3">
                    <span className="bg-gradient-cyber bg-clip-text text-transparent">Análise de Segurança</span>
                    {scanStatus === 'running' && <Loader2 className="w-5 h-5 text-cyber-cyan animate-spin" />}
                  </h1>
                  <p className="text-sm text-cyber-muted mt-1">Configure e execute scanners de segurança no seu projeto</p>
                </div>

                {/* Configurações do Scan (Projeto e URL Lado a Lado) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Project Selector */}
                  <div className="glass rounded-xl p-5 flex flex-col justify-between">
                    <div>
                      <h2 className="text-sm font-medium text-cyber-muted uppercase tracking-wider mb-3">Projeto</h2>
                      <button onClick={handleSelectDir} className="w-full flex items-center gap-3 p-4 rounded-lg border border-dashed border-cyber-border hover:border-cyber-cyan/40 transition-all group">
                        <FolderOpen className="w-5 h-5 text-cyber-muted group-hover:text-cyber-cyan transition-colors" />
                        {projectDir ? (
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-sm font-mono text-white truncate">{projectDir}</p>
                            {projectInfo && (
                              <p className="text-xs text-cyber-muted mt-1">
                                {projectInfo.frameworks?.join(', ') || 'Projeto detectado'} • {projectInfo.language?.join(', ')}
                                {projectInfo.hasGit && ' • Git ✓'}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-cyber-muted">Clique para selecionar o diretório do projeto</span>
                        )}
                        <ChevronRight className="w-4 h-4 text-cyber-muted" />
                      </button>
                    </div>
                  </div>

                  {/* URL de Produção */}
                  <div className="glass rounded-xl p-5 flex flex-col justify-between">
                    <div>
                      <h2 className="text-sm font-medium text-cyber-muted uppercase tracking-wider mb-3">URL de Produção</h2>
                      <input
                        type="text"
                        value={scanUrl}
                        onChange={(e) => setScanUrl(e.target.value)}
                        placeholder="https://meusite.com.br"
                        className="w-full bg-cyber-bg border border-cyber-border rounded-lg px-4 py-3 text-sm font-mono text-white placeholder:text-cyber-muted/40 focus:outline-none focus:border-cyber-cyan/50 focus:shadow-glow-cyan transition-all"
                      />
                      <p className="text-xs text-cyber-muted/60 mt-2 flex items-center gap-1">
                        <Info className="w-3 h-3" /> Necessária para: {urlToolNames}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tool Selection */}
                <div className="glass rounded-xl p-5">
                  <h2 className="text-sm font-medium text-cyber-muted uppercase tracking-wider mb-4">Ferramentas</h2>

                  {/* Presets Rápidos */}
                  <div className="mb-6">
                    <p className="text-[10px] font-mono text-cyber-muted/60 uppercase tracking-widest mb-2">Selecione um Perfil de Scan</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {PRESETS.map(preset => {
                        const active = isPresetActive(preset.tools)
                        const Icon = preset.icon
                        return (
                          <button
                            key={preset.id}
                            onClick={() => handleApplyPreset(preset.tools)}
                            disabled={scanStatus === 'running'}
                            className={`flex items-center gap-2 p-3 rounded-lg border text-xs font-mono transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                              ${active 
                                ? `${preset.activeClass}` 
                                : 'border-cyber-border/40 bg-white/[0.01] text-cyber-muted hover:border-cyber-border hover:bg-white/[0.03]'}`}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span>{preset.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {Object.entries(TOOL_CATEGORIES).map(([catId, cat]) => (
                      <div key={catId}>
                        <h3 className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: cat.color + 'aa' }}>
                          <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: cat.color }} />
                          {cat.label}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {TOOLS.filter(t => t.category === catId).map(tool => {
                            const available = toolAvailability[tool.id] !== false
                            const needsUrlButEmpty = tool.needsUrl && !hasUrl
                            const needsGitButEmpty = tool.needsGit && projectInfo && !projectInfo.hasGit
                            const isSelectable = available && !needsUrlButEmpty && !needsGitButEmpty
                            const canToggle = isSelectable && scanStatus !== 'running'
                            const selected = selectedTools.has(tool.id)
                            const status = toolStatuses[tool.id]
                            return (
                              <div
                                key={tool.id}
                                onClick={() => canToggle && handleToggleTool(tool.id)}
                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 border
                                  ${selected
                                    ? 'border-cyber-cyan/30 bg-cyber-cyan/5'
                                    : 'border-transparent hover:border-cyber-border hover:bg-white/[0.02]'}
                                  ${(!isSelectable) ? 'opacity-40 cursor-not-allowed' : ''}
                                `}
                              >
                                <div className={`toggle-switch ${selected ? 'active' : ''}`} />
                                <tool.icon className={`w-4 h-4 shrink-0 ${selected ? 'text-cyber-cyan' : 'text-cyber-muted'}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${selected ? 'text-white' : 'text-cyber-muted'}`}>{tool.name}</span>
                                    {status === 'running' && <Loader2 className="w-3 h-3 text-cyber-cyan animate-spin" />}
                                    {status === 'success' && <CheckCircle2 className="w-3 h-3 text-cyber-green" />}
                                    {status === 'failed' && <XCircle className="w-3 h-3 text-cyber-red" />}
                                    {!available && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleRunSetup(tool.id) }}
                                        disabled={setupRunning !== null}
                                        className="badge badge-info hover:bg-cyber-cyan/30 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Clique para instalar"
                                      >
                                        {setupRunning === tool.id || setupRunning === 'all' ? '⏳ Instalando...' : '⚙ Instalar'}
                                      </button>
                                    )}
                                    {available && needsUrlButEmpty && <span className="badge badge-medium">Preencha a URL</span>}
                                    {available && needsGitButEmpty && <span className="badge badge-medium">Requer Git</span>}
                                  </div>
                                  <p className="text-xs text-cyber-muted/60 truncate">{tool.description}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>




                {/* Terminal */}
                {(scanStatus === 'running' || scanStatus === 'complete') && (
                  <TerminalViewer logs={logs} isRunning={scanStatus === 'running'} currentTool={currentTool} />
                )}

                {/* Results Summary */}
                {scanStatus === 'complete' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5">
                    <h2 className="text-sm font-medium text-cyber-muted uppercase tracking-wider mb-4">Resultado</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(toolStatuses).map(([toolId, status]) => {
                        const tool = TOOLS.find(t => t.id === toolId)
                        if (!tool) return null
                        return (
                          <div key={toolId} className={`flex items-center gap-2 p-3 rounded-lg border
                            ${status === 'success' ? 'border-cyber-green/20 bg-cyber-green/5' : 'border-cyber-red/20 bg-cyber-red/5'}`}>
                            {status === 'success' ? <CheckCircle2 className="w-4 h-4 text-cyber-green" /> : <XCircle className="w-4 h-4 text-cyber-red" />}
                            <span className="text-sm">{tool.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {view === 'reports' && (
              <motion.div key="reports" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-5xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-semibold bg-gradient-cyber bg-clip-text text-transparent">Relatórios</h1>
                    <p className="text-sm text-cyber-muted mt-1">Histórico de análises e relatórios gerados</p>
                  </div>
                  {reports.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                      <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 text-cyber-muted absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Filtrar relatórios..."
                          value={reportFilter}
                          onChange={(e) => setReportFilter(e.target.value)}
                          className="w-full bg-black/40 border border-cyber-border/50 text-white text-sm rounded-lg pl-9 pr-4 py-2 outline-none focus:border-cyber-cyan/50 transition-colors"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={async () => {
                            if (filteredReports.length === 0) return
                            try {
                              const paths = filteredReports.map(r => r.path)
                              const md = await window.api.exportReportsAsMarkdown(paths)
                              await navigator.clipboard.writeText(md)
                              showToast('Resumo copiado para a área de transferência!')
                            } catch (e) {
                              alert('Erro ao exportar: ' + e)
                            }
                          }}
                          title="Copiar Relatórios para IA"
                          className="flex items-center justify-center p-2 rounded-lg border border-cyber-cyan/30 text-cyber-cyan hover:bg-cyber-cyan/10 transition-colors"
                        >
                          <Bot className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={async () => {
                            if (confirm('Excluir todos os relatórios mais antigos que 24 horas?')) {
                              const success = await window.api.deleteOldReports()
                              if (success) {
                                handleLoadReports()
                                showToast('Relatórios antigos excluídos com sucesso!')
                              }
                            }
                          }}
                          title="Excluir > 24h"
                          className="flex items-center justify-center p-2 rounded-lg border border-cyber-orange/30 text-cyber-orange hover:bg-cyber-orange/10 transition-colors"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={async () => {
                            if (confirm('Tem certeza que deseja excluir TODOS os relatórios?')) {
                              const success = await window.api.deleteAllReports()
                              if (success) {
                                handleLoadReports()
                                showToast('Todos os relatórios foram excluídos com sucesso!')
                              }
                            }
                          }}
                          title="Limpar Tudo"
                          className="flex items-center justify-center p-2 rounded-lg border border-cyber-red/30 text-cyber-red hover:bg-cyber-red/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {showLastScanOnly && (
                  <div className="flex items-center justify-between p-3 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded-lg text-cyber-cyan text-sm">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      <span>Exibindo <b>apenas</b> os relatórios gerados no último scan.</span>
                    </div>
                    <button onClick={() => setShowLastScanOnly(false)} className="underline hover:text-white transition-colors">
                      Limpar filtro (Ver histórico)
                    </button>
                  </div>
                )}
                 <div className="space-y-4">
                  {/* Categorias */}
                  <div className="flex flex-wrap gap-2">
                    {['Todas', 'Código-Fonte', 'Dependências & CVEs', 'Secrets & Credenciais', 'Frontend & HTTP', 'Carga & Estabilidade'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => {
                          setCategoryFilter(cat)
                          setSeverityFilter('Todas') // Resetar severidade ao mudar de categoria
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-all flex items-center gap-2 ${categoryFilter === cat ? 'bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan' : 'bg-black/40 border-cyber-border/50 text-cyber-muted hover:border-cyber-cyan/50 hover:text-white'}`}
                      >
                        {cat === 'Todas' && <Filter className="w-3 h-3" />}
                        {cat === 'Código-Fonte' && <Code className="w-3 h-3" />}
                        {cat === 'Dependências & CVEs' && <Package className="w-3 h-3" />}
                        {cat === 'Secrets & Credenciais' && <Lock className="w-3 h-3" />}
                        {cat === 'Frontend & HTTP' && <Globe className="w-3 h-3" />}
                        {cat === 'Carga & Estabilidade' && <Activity className="w-3 h-3" />}
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Filtro de Risco / Severidade */}
                  <div className="flex flex-wrap items-center gap-2 bg-cyber-surface/30 p-3 rounded-xl border border-cyber-border/30">
                    <span className="text-[10px] font-mono text-cyber-muted uppercase tracking-widest mr-2 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-cyber-cyan" /> Risco:
                    </span>
                    {[
                      { id: 'Todas', label: 'Todos os Riscos', count: reportsByCategory.length, activeClass: 'bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan shadow-[0_0_10px_rgba(0,240,255,0.15)]', color: 'text-cyber-muted border-cyber-border/50 bg-black/40 hover:border-cyber-cyan/40 hover:text-white' },
                      { id: 'critical', label: 'Crítico 🔴', count: reportsByCategory.filter(r => getReportSeverity(r) === 'critical').length, activeClass: 'bg-cyber-red/20 border-cyber-red text-cyber-red shadow-[0_0_10px_rgba(255,23,68,0.2)]', color: 'text-cyber-red border-cyber-red/30 bg-cyber-red/5 hover:bg-cyber-red/10' },
                      { id: 'high', label: 'Alto 🟠', count: reportsByCategory.filter(r => getReportSeverity(r) === 'high').length, activeClass: 'bg-cyber-orange/20 border-cyber-orange text-cyber-orange shadow-[0_0_10px_rgba(255,145,0,0.2)]', color: 'text-cyber-orange border-cyber-orange/30 bg-cyber-orange/5 hover:bg-cyber-orange/10' },
                      { id: 'medium', label: 'Médio 🟡', count: reportsByCategory.filter(r => getReportSeverity(r) === 'medium').length, activeClass: 'bg-cyber-yellow/20 border-cyber-yellow text-cyber-yellow shadow-[0_0_10px_rgba(255,234,0,0.2)]', color: 'text-cyber-yellow border-cyber-yellow/30 bg-cyber-yellow/5 hover:bg-cyber-yellow/10' },
                      { id: 'low', label: 'Baixo 🟢', count: reportsByCategory.filter(r => getReportSeverity(r) === 'low').length, activeClass: 'bg-cyber-green/20 border-cyber-green text-cyber-green shadow-[0_0_10px_rgba(0,230,118,0.2)]', color: 'text-cyber-green border-cyber-green/30 bg-cyber-green/5 hover:bg-cyber-green/10' },
                    ].map(item => {
                      const active = severityFilter === item.id
                      return (
                        <button
                          key={item.id}
                          onClick={() => setSeverityFilter(item.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-all flex items-center gap-2 ${
                            active ? item.activeClass : item.color
                          }`}
                        >
                          {item.label}
                          <span className="opacity-60 text-[10px]">({item.count})</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                
                {(() => {
                  if (reports.length === 0) {
                    return (
                      <div className="glass rounded-xl p-10 text-center">
                        <FileText className="w-10 h-10 text-cyber-muted/30 mx-auto mb-3" />
                        <p className="text-cyber-muted">Nenhum relatório encontrado</p>
                        <p className="text-xs text-cyber-muted/50 mt-1">Execute um scan para gerar relatórios</p>
                      </div>
                    )
                  }

                  if (filteredReports.length === 0) {
                    return (
                      <div className="glass rounded-xl p-10 text-center">
                        <Search className="w-10 h-10 text-cyber-muted/30 mx-auto mb-3" />
                        <p className="text-cyber-muted">Nenhum relatório corresponde ao filtro</p>
                      </div>
                    )
                  }

                  return Object.entries(
                    filteredReports.reduce<Record<string, typeof reports>>((acc, r) => {
                      const cat = r.category || 'Outros'
                      if (!acc[cat]) acc[cat] = []
                      acc[cat].push(r)
                      return acc
                    }, {})
                  ).map(([category, items]) => (
                    <div key={category} className="space-y-2">
                      <h2 className="text-xs font-mono uppercase tracking-widest text-cyber-muted/70 flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          category.includes('Secrets') ? 'bg-cyber-red' :
                          category.includes('Codigo') ? 'bg-cyber-violet' :
                          category.includes('CVEs') ? 'bg-cyber-orange' :
                          category.includes('Frontend') ? 'bg-cyber-cyan' :
                          'bg-cyber-green'
                        }`} />
                        {category}
                        <span className="text-cyber-muted/40">({items.length})</span>
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-3">
                        {items.map((report, i) => {
                          const severity = getReportSeverity(report)
                          const sevConfig = {
                            critical: { text: 'Crítico 🔴', classes: 'bg-cyber-red/20 border-cyber-red/30 text-cyber-red', barClass: 'bg-cyber-red shadow-[0_1px_8px_rgba(255,23,68,0.5)]' },
                            high: { text: 'Alto 🟠', classes: 'bg-cyber-orange/20 border-cyber-orange/30 text-cyber-orange', barClass: 'bg-cyber-orange shadow-[0_1px_8px_rgba(255,145,0,0.5)]' },
                            medium: { text: 'Médio 🟡', classes: 'bg-cyber-yellow/20 border-cyber-yellow/30 text-cyber-yellow', barClass: 'bg-cyber-yellow shadow-[0_1px_8px_rgba(255,234,0,0.5)]' },
                            low: { text: 'Baixo 🟢', classes: 'bg-cyber-green/20 border-cyber-green/30 text-cyber-green', barClass: 'bg-cyber-green shadow-[0_1px_8px_rgba(0,230,118,0.5)]' },
                          }[severity]

                          return (
                            <motion.div
                              key={report.name}
                              whileHover={{ scale: 1.02 }}
                              onClick={() => setSelectedReport(report)}
                              className="group flex flex-col justify-between p-4 bg-black/30 hover:bg-cyber-cyan/5 border border-cyber-border/40 hover:border-cyber-cyan/50 rounded-xl cursor-pointer transition-all relative overflow-hidden shadow-lg pt-5"
                            >
                              {/* Barrinha brilhante de Risco no topo do Card */}
                              <div className={`absolute top-0 left-0 right-0 h-[3px] ${sevConfig.barClass}`} />

                              <div className="absolute top-1 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ExternalLink className="w-4 h-4 text-cyber-cyan" />
                              </div>
                              
                              <div className="mb-6">
                                <div className="flex flex-wrap gap-2 mb-3">
                                  <span className={`badge uppercase tracking-wider text-[10px] ${getToolColor(report.tool)}`}>
                                    {report.tool}
                                  </span>
                                  <span className={`badge uppercase tracking-wider text-[10px] ${sevConfig.classes}`}>
                                    {sevConfig.text}
                                  </span>
                                </div>
                                <p className="text-[13px] font-mono text-gray-200 leading-snug break-words line-clamp-2" title={report.name.replace(/-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.(json|html)$/, '').replace('-', ' ')}>
                                  {report.name.replace(/-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.(json|html)$/, '').replace('-', ' ')}
                                </p>
                              
                              {report.tool === 'lighthouse' && report.summary && (
                                <div className="mt-4 grid grid-cols-[1fr_auto] gap-y-1.5 gap-x-2 bg-black/40 p-2.5 rounded border border-white/5 text-[10px] font-mono uppercase tracking-wider">
                                  <div className="text-cyber-muted">Performance</div>
                                  <div className={`text-right font-bold ${report.summary.performance >= 90 ? 'text-cyber-green' : report.summary.performance >= 50 ? 'text-cyber-orange' : 'text-cyber-red'}`}>{report.summary.performance}</div>
                                  
                                  <div className="text-cyber-muted">Accessibility</div>
                                  <div className={`text-right font-bold ${report.summary.accessibility >= 90 ? 'text-cyber-green' : report.summary.accessibility >= 50 ? 'text-cyber-orange' : 'text-cyber-red'}`}>{report.summary.accessibility}</div>
                                  
                                  <div className="text-cyber-muted">Best Practices</div>
                                  <div className={`text-right font-bold ${report.summary.bestPractices >= 90 ? 'text-cyber-green' : report.summary.bestPractices >= 50 ? 'text-cyber-orange' : 'text-cyber-red'}`}>{report.summary.bestPractices}</div>
                                  
                                  <div className="text-cyber-muted">SEO</div>
                                  <div className={`text-right font-bold ${report.summary.seo >= 90 ? 'text-cyber-green' : report.summary.seo >= 50 ? 'text-cyber-orange' : 'text-cyber-red'}`}>{report.summary.seo}</div>
                                </div>
                              )}

                              {report.tool === 'snyk' && report.summary && (
                                <div className="mt-4 flex items-center justify-between bg-black/40 p-2.5 rounded border border-white/5 text-[10px] font-mono uppercase tracking-wider">
                                  <span className="text-cyber-muted">Vulns</span>
                                  <div className="flex gap-2 font-bold">
                                    <span className={report.summary.critical > 0 ? 'text-cyber-red' : 'text-gray-600'} title="Critical">C:{report.summary.critical}</span>
                                    <span className={report.summary.high > 0 ? 'text-cyber-orange' : 'text-gray-600'} title="High">H:{report.summary.high}</span>
                                    <span className={report.summary.total > 0 ? 'text-cyber-blue' : 'text-cyber-green'} title="Total">T:{report.summary.total}</span>
                                  </div>
                                </div>
                              )}

                              {report.tool === 'semgrep' && report.summary && (
                                <div className="mt-4 flex items-center justify-between bg-black/40 p-2.5 rounded border border-white/5 text-[10px] font-mono uppercase tracking-wider">
                                  <span className="text-cyber-muted">Issues</span>
                                  <div className="flex gap-2 font-bold">
                                    <span className={report.summary.error > 0 ? 'text-cyber-red' : 'text-gray-600'} title="Errors">E:{report.summary.error}</span>
                                    <span className={report.summary.warning > 0 ? 'text-cyber-orange' : 'text-gray-600'} title="Warnings">W:{report.summary.warning}</span>
                                  </div>
                                </div>
                              )}

                              {report.tool === 'depcheck' && report.summary && (
                                <div className="mt-4 flex items-center justify-between bg-black/40 p-2.5 rounded border border-white/5 text-[10px] font-mono uppercase tracking-wider">
                                  <span className="text-cyber-muted">Unused</span>
                                  <div className="flex gap-2 font-bold">
                                    <span className={report.summary.unused > 0 ? 'text-cyber-orange' : 'text-gray-600'} title="Dependencies">{report.summary.unused}</span>
                                    <span className={report.summary.dev > 0 ? 'text-cyber-blue' : 'text-gray-600'} title="DevDependencies">D:{report.summary.dev}</span>
                                  </div>
                                </div>
                              )}

                              {report.tool === 'observatory' && report.summary && (
                                <div className="mt-4 flex items-center justify-between bg-black/40 p-2.5 rounded border border-white/5 text-[10px] font-mono uppercase tracking-wider">
                                  <span className="text-cyber-muted">Score</span>
                                  <div className="flex gap-3 font-bold items-center">
                                    <span className={['A', 'B'].includes(report.summary.grade) ? 'text-cyber-green' : ['C','D'].includes(report.summary.grade) ? 'text-cyber-orange' : 'text-cyber-red'}>
                                      GRADE: {report.summary.grade || 'N/A'}
                                    </span>
                                    <span className="text-white">{report.summary.score}/100</span>
                                  </div>
                                </div>
                              )}

                              {(report.tool === 'trufflehog' || report.tool === 'gitleaks') && report.summary && (
                                <div className="mt-4 flex items-center justify-between bg-black/40 p-2.5 rounded border border-white/5 text-[10px] font-mono uppercase tracking-wider">
                                  <span className="text-cyber-muted">Segredos</span>
                                  <div className="flex gap-2 font-bold">
                                    {report.tool === 'trufflehog' && <span className={report.summary.verified > 0 ? 'text-cyber-red' : 'text-gray-600'} title="Verified">V:{report.summary.verified}</span>}
                                    <span className={report.summary.total > 0 ? 'text-cyber-orange' : 'text-cyber-green'} title="Total">T:{report.summary.total}</span>
                                  </div>
                                </div>
                              )}

                              {report.tool === 'k6' && report.summary && (
                                <div className="mt-4 grid grid-cols-2 gap-y-1 bg-black/40 p-2.5 rounded border border-white/5 text-[10px] font-mono uppercase tracking-wider">
                                  <div className="text-cyber-muted">Requests</div>
                                  <div className="text-right text-cyber-blue font-bold">{report.summary.reqs}</div>
                                  
                                  <div className="text-cyber-muted">Errors</div>
                                  <div className={`text-right font-bold ${report.summary.errors > 0 ? 'text-cyber-red' : 'text-cyber-green'}`}>{report.summary.errors}%</div>
                                  
                                  <div className="text-cyber-muted">Max VUs</div>
                                  <div className="text-right text-cyber-cyan font-bold">{report.summary.vus}</div>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center justify-between mt-auto pt-3 border-t border-cyber-border/30">
                              <p className="text-xs text-cyber-muted flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                {new Date(report.modified).toLocaleDateString('pt-BR')} às {new Date(report.modified).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                              </p>
                            </div>
                          </motion.div>
                        )
                      })}
                      </div>
                    </div>
                  ))
                })()}
              </motion.div>
            )}

            {view === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-3xl">
                <div>
                  <h1 className="text-2xl font-semibold bg-gradient-cyber bg-clip-text text-transparent">Configurações</h1>
                  <p className="text-sm text-cyber-muted mt-1">Gerencie a aparência, ferramentas e autenticação</p>
                </div>

                {/* Seletor de Tema Visual (Estética Cyberpunk) */}
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2.5 mb-2">
                    <Palette className="w-4 h-4 text-cyber-cyan" />
                    <h2 className="text-sm font-medium text-cyber-muted uppercase tracking-wider">Estética & Tema Visual</h2>
                  </div>
                  <p className="text-xs text-cyber-muted/70 mb-4">Escolha a paleta de cores de neon para personalizar a estética gráfica do TigoSec Toolkit.</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { id: 'cyan', name: 'Ciano Cyberpunk 🩵', desc: 'Estilo neon clássico ciano e roxo', activeBorder: 'border-[#00f0ff]', colors: ['bg-[#00f0ff]', 'bg-[#8b5cf6]'] },
                      { id: 'green', name: 'Verde Terminal 💚', desc: 'Estilo retro hacker fósforo verde', activeBorder: 'border-[#00e676]', colors: ['bg-[#00e676]', 'bg-[#009624]'] },
                      { id: 'purple', name: 'Roxo Synthwave 💜', desc: 'Estilo espacial profundo magenta e azul', activeBorder: 'border-[#e040fb]', colors: ['bg-[#e040fb]', 'bg-[#00f0ff]'] },
                      { id: 'candy', name: 'Confeitaria 🍰', desc: 'Estilo doce pastel com cupcakes e chocolate', activeBorder: 'border-[#ff80ab]', colors: ['bg-[#ff80ab]', 'bg-[#a7ffeb]'] },
                    ].map(t => {
                      const active = theme === t.id
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            setTheme(t.id as any)
                            showToast(`Tema alterado para ${t.name}!`)
                          }}
                          className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                            active 
                              ? `bg-cyber-cyan/5 ${t.activeBorder} shadow-[0_0_15px_rgba(var(--cyber-cyan),0.1)]` 
                              : 'bg-black/30 border-cyber-border/50 hover:border-cyber-cyan/30'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className={`text-xs font-mono font-bold ${active ? 'text-cyber-cyan' : 'text-gray-300'}`}>
                              {t.name}
                            </span>
                            <div className="flex items-center gap-1">
                              {t.colors.map((c, i) => (
                                <span key={i} className={`inline-block w-2.5 h-2.5 rounded-full ${c}`} />
                              ))}
                            </div>
                          </div>
                          <span className="text-[10px] text-cyber-muted leading-relaxed">
                            {t.desc}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Tool Status */}
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-medium text-cyber-muted uppercase tracking-wider">Status das Ferramentas</h2>
                    <button
                      onClick={() => handleRunSetup()}
                      disabled={setupRunning !== null}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border border-cyber-cyan/30 text-cyber-cyan hover:bg-cyber-cyan/10 transition-all disabled:opacity-50"
                    >
                      {setupRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Settings className="w-3 h-3" />}
                      {setupRunning ? 'Instalando...' : 'Instalar Ferramentas'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {TOOLS.map(tool => (
                      <div key={tool.id} className="flex items-center gap-2 p-2 rounded-lg">
                        {toolAvailability[tool.id] !== false
                          ? <CheckCircle2 className="w-4 h-4 text-cyber-green" />
                          : <XCircle className="w-4 h-4 text-cyber-red/60" />}
                        <span className="text-sm">{tool.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Snyk Auth */}
                <div className="glass rounded-xl p-5">
                  <h2 className="text-sm font-medium text-cyber-muted uppercase tracking-wider mb-4">Autenticação Snyk</h2>
                  <div className="flex items-center justify-between">
                    <div>
                      {snykStatus.authenticated ? (
                        <p className="text-sm text-cyber-green flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Autenticado como <span className="font-mono">{snykStatus.user}</span>
                        </p>
                      ) : (
                        <p className="text-sm text-cyber-muted">Snyk não autenticado — necessário para análise de CVEs</p>
                      )}
                    </div>
                    <button onClick={handleSnykAuth} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border border-cyber-violet/30 text-cyber-violet hover:bg-cyber-violet/10 transition-all">
                      <ExternalLink className="w-3 h-3" /> {snykStatus.authenticated ? 'Re-autenticar' : 'Login via Browser'}
                    </button>
                  </div>
                </div>

                {/* Sobre o Projeto */}
                <div className="glass rounded-xl p-5 border border-white/5 bg-white/[0.01]">
                  <h2 className="text-sm font-medium text-cyber-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Info className="w-4 h-4" /> Sobre o Projeto
                  </h2>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-300 leading-relaxed">
                      O <span className="text-cyber-cyan font-bold">TigoSecToolkit</span> é um ecossistema de ferramentas de segurança modular e portátil, desenvolvido para automatizar a análise de vulnerabilidades em projetos web e infraestrutura.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-y-4 pt-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-cyber-muted mb-0.5 font-mono">Desenvolvedor</p>
                        <p className="text-sm font-medium">Thiago Santana</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-cyber-muted mb-0.5 font-mono">Contato</p>
                        <p className="text-sm font-mono text-cyber-cyan">thiagosantana888@gmail.com</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-cyber-muted mb-0.5 font-mono">Versão</p>
                        <p className="text-sm font-mono">v1.5.0-PRO</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-cyber-muted mb-0.5 font-mono">Build Date</p>
                        <p className="text-sm font-mono">Maio de 2026</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 mt-2">
                      <p className="text-[10px] text-cyber-muted/60 font-mono text-center">
                        © 2026 Thiago Santana. Todos os direitos reservados.
                        <br />Desenvolvido para uso profissional e auditorias de segurança.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Setup Logs */}
                {setupLogs.length > 0 && (
                  <div className="terminal max-h-64">
                    {setupLogs.map((line, i) => (
                      <div key={i} className="terminal-line stdout">{line}</div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </>
    )}
  </div>

      <AnimatePresence>
        {view === 'scan' && theme !== 'candy' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 20 }}
            className="fixed bottom-8 right-8 z-40"
          >
            {scanStatus !== 'running' ? (
              <button
                onClick={handleStartScan}
                disabled={!projectDir || selectedTools.size === 0}
                className="flex items-center gap-2 px-8 py-4 rounded-full font-bold text-sm transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed
                  bg-cyber-cyan text-black shadow-[0_0_20px_rgba(var(--cyber-cyan-rgb),0.4)]
                  hover:shadow-[0_0_30px_rgba(var(--cyber-cyan-rgb),0.6)] hover:scale-105"
              >
                <Play className="w-5 h-5 fill-current" />
                INICIAR SCAN ({selectedTools.size})
              </button>
            ) : (
              <button 
                onClick={handleAbortScan} 
                className="flex items-center gap-2 px-8 py-4 rounded-full font-bold text-sm bg-cyber-red text-white shadow-[0_0_20px_rgba(255,0,0,0.4)] hover:scale-105 transition-all animate-pulse"
              >
                <Square className="w-5 h-5 fill-current" />
                ABORTAR SCAN
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scanStatus === 'complete' && view === 'scan' && theme !== 'candy' && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, x: -20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: -20 }}
            onClick={handleViewResults}
            className="fixed bottom-8 left-28 z-40 flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-full hover:bg-white/10 transition-all hover:scale-105 shadow-xl backdrop-blur-md"
          >
            <FileText className="w-5 h-5 text-cyber-cyan" />
            Abrir Relatórios
          </motion.button>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-8 left-1/2 z-50 px-6 py-3 bg-cyber-green/20 border border-cyber-green text-cyber-green font-mono rounded-lg shadow-[0_0_15px_rgba(0,255,0,0.2)] backdrop-blur-md flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Viewer Modal */}
      <AnimatePresence>
        {selectedReport && (
          <ReportViewer
            report={selectedReport}
            onClose={() => setSelectedReport(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
