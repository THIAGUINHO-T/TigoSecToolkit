import React from 'react'
import { Shield, FileText, Settings, Lock, Globe, CheckCircle2, ChevronRight, Activity, XCircle, Loader2, Code, Package, Search, Bot, Trash2, Clock, Filter, Palette } from 'lucide-react'
import { TOOLS, TOOL_CATEGORIES } from '../lib/tools-config'
import type { ReportFile, LogEntry } from '../types'

interface CandyDashboardProps {
  projectDir: string
  handleSelectDirectory: () => void
  scanUrl: string
  setScanUrl: (url: string) => void
  view: 'scan' | 'reports' | 'settings'
  setView: (view: any) => void
  theme: 'cyan' | 'green' | 'purple' | 'candy'
  setTheme: (theme: any) => void
  selectedTools: Set<string>
  setSelectedTools: (tools: Set<string>) => void
  isPresetActive: (presetTools: string[]) => boolean
  handleApplyPreset: (toolIds: string[]) => void
  toolAvailability: Record<string, boolean>
  toolStatuses: Record<string, 'pending' | 'running' | 'success' | 'failed'>
  handleRunSetup: (toolId: string) => void
  scanStatus: 'idle' | 'running' | 'complete'
  handleStartScan: () => void
  handleAbortScan: () => void
  reportFilter: string
  setReportFilter: (filter: string) => void
  severityFilter: string
  setSeverityFilter: (filter: string) => void
  filteredReports: ReportFile[]
  setSelectedReport: (report: ReportFile) => void
  handleDeleteAllReports: () => void
  handleDeleteOldReports: () => void
  showToast: (msg: string) => void
  logs: LogEntry[]
}

export default function CandyDashboard({
  projectDir,
  handleSelectDirectory,
  scanUrl,
  setScanUrl,
  view,
  setView,
  theme,
  setTheme,
  selectedTools,
  setSelectedTools,
  isPresetActive,
  handleApplyPreset,
  toolAvailability,
  toolStatuses,
  handleRunSetup,
  scanStatus,
  handleStartScan,
  handleAbortScan,
  reportFilter,
  setReportFilter,
  severityFilter,
  setSeverityFilter,
  filteredReports,
  setSelectedReport,
  handleDeleteAllReports,
  handleDeleteOldReports,
  showToast,
  logs
}: CandyDashboardProps) {

  const getReportSeverity = (report: ReportFile): 'critical' | 'high' | 'medium' | 'low' => {
    const tool = report.tool.toLowerCase()
    const summary = report.summary

    if (!summary) return 'low'

    switch (tool) {
      case 'gitleaks':
        return summary.total > 0 ? 'high' : 'low'
      case 'trufflehog':
        return summary.total > 0 ? 'critical' : 'low'
      case 'semgrep':
        return summary.errors > 0 ? 'high' : summary.warnings > 0 ? 'medium' : 'low'
      case 'depcheck':
        return (summary.dependencies?.length > 0 || summary.devDependencies?.length > 0) ? 'medium' : 'low'
      case 'madge':
        return summary.circular > 0 ? 'medium' : 'low'
      case 'snyk':
        return (summary.critical > 0 || summary.high > 0) ? 'high' : summary.medium > 0 ? 'medium' : 'low'
      case 'nuclei':
        return summary.critical > 0 ? 'critical' : summary.high > 0 ? 'high' : summary.medium > 0 ? 'medium' : 'low'
      case 'lighthouse':
        return (summary.performance < 50 || summary.security < 50) ? 'high' : 'low'
      case 'observatory':
        return summary.score < 50 ? 'high' : 'low'
      case 'k6':
        return summary.failedTests > 0 ? 'high' : 'low'
      default:
        return 'low'
    }
  }

  const PRESETS = [
    { id: 'all', label: 'Scan Completo', icon: Shield, tools: TOOLS.map(t => t.id) },
    { id: 'secrets', label: 'Apenas Segredos', icon: Lock, tools: ['gitleaks', 'trufflehog'] },
    { id: 'sast', label: 'Qualidade & SAST', icon: Code, tools: ['semgrep', 'depcheck', 'madge', 'snyk'] },
    { id: 'web', label: 'Web & Carga', icon: Globe, tools: ['nuclei', 'lighthouse', 'observatory', 'k6'] },
  ]

  const hasUrl = scanUrl.trim().length > 0
  const urlToolNames = TOOLS.filter(t => t.needsUrl).map(t => t.name).join(', ')

  return (
    <div className="flex-1 overflow-hidden flex items-center justify-center bg-[#25150d] font-sans p-0 select-none animate-fadeIn">
      <div className="relative w-full h-full bg-[url('/imagemdefundo.png')] bg-cover bg-no-repeat overflow-hidden">
        
        {/* NAVEGAÇÃO DA BARRA LATERAL VERTICAL DE CHOCOLATE (Os 3 Primeiros Quadradinhos) */}
        {[
          { id: 'scan', top: '5.1%', icon: Shield, tooltip: '🧁 Scans & Ferramentas' },
          { id: 'reports', top: '10.5%', icon: FileText, tooltip: '🍩 Relatórios de Segurança' },
          { id: 'settings', top: '15.9%', icon: Settings, tooltip: '🍬 Configurações de Estética' }
        ].map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setView(tab.id as any)}
              className={`absolute left-[1.3%] w-[3.4%] h-[4.7%] transition-all duration-300 flex items-center justify-center cursor-pointer group z-40
                ${view === tab.id ? 'scale-105' : 'active:scale-95'}`}
              style={{ top: tab.top }}
              title={tab.tooltip}
            >
              <Icon 
                strokeWidth={view === tab.id ? 3 : 2.5}
                className={`w-[26px] h-[26px] transition-all duration-300 ${view === tab.id ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.9)] scale-110' : 'text-white/65 group-hover:text-white'}`} 
              />
              <span className="absolute left-[120%] ml-2 px-2.5 py-1 text-[10px] font-bold bg-[#25150d] border border-amber-200/20 text-[#fbe9e7] rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {tab.tooltip}
              </span>
            </button>
          )
        })}

        {/* CONTAINER DA APLICAÇÃO À DIREITA DA BARRA DE CHOCOLATE */}
        <div className="absolute left-[7.5%] top-[3.0%] w-[92.5%] h-[94.0%] flex flex-col text-emerald-950 z-20">
          <div className="flex-1 overflow-y-auto pl-6 pt-6 pb-6 pr-8">
          
          {view === 'scan' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Cabeçalho */}
              <div>
                <h1 className="text-2xl font-black text-white flex items-center gap-2 drop-shadow-[0_2px_4px_rgba(37,21,13,0.95)]">
                  🍩 Análise de Segurança
                  {scanStatus === 'running' && <Loader2 className="w-5 h-5 text-[#ff80ab] animate-spin" />}
                </h1>
                <p className="text-xs text-[#ffd1dc] font-extrabold uppercase tracking-wider mt-1 drop-shadow-[0_1.5px_2px_rgba(37,21,13,0.95)]">
                  Configure e execute os scanners de segurança do seu projeto
                </p>
              </div>

              {/* Configurações do Scan (Projeto e URL Lado a Lado) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Projeto */}
                <div className="bg-white/50 backdrop-blur-sm border border-emerald-850/10 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <h2 className="text-[10px] font-black text-emerald-950/80 uppercase tracking-widest mb-2.5">📂 Projeto</h2>
                    <button 
                      onClick={handleSelectDirectory}
                      className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-emerald-850/30 bg-white/40 hover:bg-white/70 hover:border-emerald-800/50 transition-all group text-left cursor-pointer"
                    >
                      <span className="text-xs font-extrabold text-[#25150d]/90 truncate flex-1">
                        {projectDir ? projectDir : "Clique para selecionar o diretório do projeto"}
                      </span>
                      <ChevronRight className="w-4 h-4 text-emerald-800/60" />
                    </button>
                  </div>
                </div>

                {/* URL de Produção */}
                <div className="bg-white/50 backdrop-blur-sm border border-emerald-850/10 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <h2 className="text-[10px] font-black text-emerald-950/80 uppercase tracking-widest mb-2.5">🌐 URL de Produção</h2>
                    <input
                      type="text"
                      value={scanUrl}
                      onChange={(e) => setScanUrl(e.target.value)}
                      placeholder="https://meusite.com.br"
                      className="w-full bg-[#25150d]/85 text-[#fbe9e7] border border-[#25150d] rounded-xl px-4 py-3.5 text-xs font-mono placeholder:text-amber-200/20 focus:outline-none focus:ring-2 focus:ring-[#ff80ab] transition-all"
                    />
                    <p className="text-[9px] text-[#25150d]/50 font-bold mt-1.5 flex items-center gap-1">
                      🧁 Necessária para: {urlToolNames}
                    </p>
                  </div>
                </div>
              </div>

              {/* Seleção de Ferramentas */}
              <div className="bg-white/50 backdrop-blur-sm border border-emerald-850/10 rounded-xl p-5">
                <h2 className="text-[10px] font-black text-emerald-950/80 uppercase tracking-widest mb-4">🍭 Ferramentas</h2>

                {/* Presets Rápidos */}
                <div className="mb-5">
                  <p className="text-[9px] font-black text-emerald-900/65 uppercase tracking-widest mb-2">Selecione um Perfil de Scan</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {PRESETS.map(preset => {
                      const active = isPresetActive(preset.tools)
                      return (
                        <button
                          key={preset.id}
                          onClick={() => handleApplyPreset(preset.tools)}
                          disabled={scanStatus === 'running'}
                          className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                            ${active 
                              ? 'bg-[#ff80ab]/20 border-[#ff80ab]/40 text-[#25150d] shadow-[0_0_12px_rgba(255,128,171,0.25)] font-black scale-102' 
                              : 'bg-white/40 border-emerald-800/10 text-emerald-900/70 hover:bg-white/65 hover:border-emerald-850/25'}`}
                        >
                          <preset.icon className="w-3.5 h-3.5 shrink-0" />
                          <span>{preset.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Grid Categorizado de Ferramentas */}
                <div className="space-y-4">
                  {Object.entries(TOOL_CATEGORIES).map(([catId, cat]) => (
                    <div key={catId} className="space-y-2">
                      <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 text-emerald-950/80">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.label}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {TOOLS.filter(t => t.category === catId).map(tool => {
                          const available = toolAvailability[tool.id] !== false
                          const needsUrlButEmpty = tool.needsUrl && !hasUrl
                          const isSelectable = available && !needsUrlButEmpty
                          const canToggle = isSelectable && scanStatus !== 'running'
                          const selected = selectedTools.has(tool.id)
                          const status = toolStatuses[tool.id]

                          return (
                            <div
                              key={tool.id}
                              onClick={() => {
                                if (!canToggle) return
                                const next = new Set(selectedTools)
                                if (next.has(tool.id)) {
                                  next.delete(tool.id)
                                } else {
                                  next.add(tool.id)
                                }
                                setSelectedTools(next)
                              }}
                              className={`flex items-center gap-3.5 p-3 rounded-xl border transition-all relative select-none
                                ${selected
                                  ? 'bg-[#ff80ab]/8 border-[#ff80ab]/30 shadow-sm'
                                  : 'bg-white/35 border-transparent hover:border-emerald-850/10 hover:bg-white/50'}
                                ${!isSelectable ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                              `}
                            >
                              {/* Toggle switch personalizado */}
                              <div className={`w-7.5 h-4.5 rounded-full p-0.5 transition-all duration-200 flex items-center
                                ${selected ? 'bg-[#ff80ab] justify-end' : 'bg-emerald-800/25 justify-start'}`}>
                                <div className="w-3.5 h-3.5 rounded-full bg-white shadow" />
                              </div>

                              <tool.icon className={`w-4.5 h-4.5 shrink-0 ${selected ? 'text-[#ff80ab]' : 'text-emerald-800'}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-black ${selected ? 'text-[#25150d]' : 'text-emerald-900'}`}>{tool.name}</span>
                                  {status === 'running' && <Loader2 className="w-3 h-3 text-[#ff80ab] animate-spin" />}
                                  {status === 'success' && <CheckCircle2 className="w-3 h-3 text-emerald-800" />}
                                  {status === 'failed' && <XCircle className="w-3 h-3 text-red-650" />}
                                  {!available && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleRunSetup(tool.id)
                                      }}
                                      className="text-[9px] font-black text-amber-900 bg-amber-500/20 hover:bg-amber-500/35 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                                    >
                                      INSTALAR
                                    </button>
                                  )}
                                  {available && needsUrlButEmpty && (
                                    <span className="text-[9px] font-bold text-amber-800 bg-amber-500/10 px-1.5 py-0.5 rounded">REQUER URL</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-emerald-900/60 truncate mt-0.5">{tool.description}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Real-time Console logs */}
              {logs.length > 0 && (
                <div className="p-3 bg-white/50 border border-emerald-850/10 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-emerald-800 animate-pulse" /> Terminal Ativo
                    </span>
                    <span className="text-[9px] font-mono text-emerald-800/70">{logs.length} linhas</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto p-2.5 bg-[#25150d]/90 rounded-xl text-[10px] font-mono text-white space-y-0.5 scrollbar-thin">
                    {logs.map((log, i) => {
                      const line = log.line;
                      let colorClass = "text-white"; // Branco por padrão!
                      if (line.includes('✅') || line.includes('Nenhum')) colorClass = "text-emerald-400 font-bold";
                      else if (line.includes('❌') || line.includes('ERRO') || line.includes('Error') || log.stream === 'stderr') colorClass = "text-red-400 font-bold";
                      else if (line.includes('⚠️') || line.includes('WARNING')) colorClass = "text-yellow-400 font-bold";
                      else if (line.includes('🔍') || line.includes('🔬') || line.includes('💡') || line.includes('⚡')) colorClass = "text-[#ff80ab] font-bold";
                      return (
                        <div key={i} className={`whitespace-pre-wrap break-all ${colorClass}`}>
                          {log.line}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Botão de Iniciar Scan Real em HTML */}
              <button
                onClick={scanStatus === 'running' ? handleAbortScan : handleStartScan}
                disabled={!projectDir || selectedTools.size === 0}
                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-xs font-black text-white transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none
                  ${scanStatus === 'running'
                    ? 'bg-red-500 hover:bg-red-650 shadow-glow-red animate-pulse'
                    : 'bg-gradient-to-r from-[#ff80ab] to-[#ff4081] hover:from-[#ff4081] hover:to-[#f50057] shadow-[0_4px_15px_rgba(255,64,129,0.3)] hover:shadow-[0_6px_20px_rgba(255,64,129,0.5)] active:scale-98'}`}
              >
                {scanStatus === 'running' ? 'ABORTAR SCAN EM EXECUÇÃO' : '🍩 ASSAR E INICIAR SCAN'}
              </button>

            </div>
          )}

          {view === 'reports' && (
            <div className="space-y-4 pr-1.5 py-1 animate-fadeIn text-emerald-950">
              {/* Cabeçalho */}
              <div>
                <h1 className="text-2xl font-black text-white flex items-center gap-2 drop-shadow-[0_2px_4px_rgba(37,21,13,0.95)]">
                  🍩 Relatórios de Segurança
                </h1>
                <p className="text-xs text-[#ffd1dc] font-extrabold uppercase tracking-wider mt-1 drop-shadow-[0_1.5px_2px_rgba(37,21,13,0.95)]">
                  Histórico de análises e vulnerabilidades geradas
                </p>
              </div>

              {/* Filtros em Confeitaria */}
              <div className="flex flex-wrap items-center gap-2 bg-white/50 backdrop-blur-sm p-3 rounded-xl border border-emerald-850/10">
                <span className="text-[10px] font-black text-emerald-950/80 uppercase">🍩 Filtros rápidos:</span>
                <input 
                  type="text"
                  placeholder="Buscar relatório..."
                  value={reportFilter}
                  onChange={(e) => setReportFilter(e.target.value)}
                  className="text-xs font-bold bg-white/70 border border-emerald-850/15 rounded-lg px-2.5 py-1.5 text-[#25150d] placeholder-emerald-900/40 outline-none flex-1 max-w-[200px] focus:ring-1 focus:ring-[#ff80ab] transition-all"
                />
                <select 
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="text-xs font-bold bg-white/70 border border-emerald-850/15 rounded-lg px-2 py-1.5 text-[#25150d] outline-none cursor-pointer focus:ring-1 focus:ring-[#ff80ab] transition-all"
                >
                  <option value="Todas">Todas Severidades</option>
                  <option value="critical">🔴 Crítico</option>
                  <option value="high">🟠 Alto</option>
                  <option value="medium">🟡 Médio</option>
                  <option value="low">🟢 Baixo</option>
                </select>

                <div className="flex items-center gap-2 ml-auto">
                  <button 
                    onClick={async () => {
                      if (filteredReports.length === 0) return
                      try {
                        const paths = filteredReports.map(r => r.path)
                        const md = await (window as any).api.exportReportsAsMarkdown(paths)
                        await navigator.clipboard.writeText(md)
                        showToast('Resumo copiado para a área de transferência!')
                      } catch (e) {
                        alert('Erro ao exportar: ' + e)
                      }
                    }}
                    title="Copiar Relatórios para IA"
                    className="flex items-center justify-center p-2 rounded-lg border border-emerald-800/30 text-emerald-900 hover:bg-[#ff80ab]/10 hover:border-[#ff80ab]/40 transition-colors cursor-pointer"
                  >
                    <Bot className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={handleDeleteOldReports}
                    title="Excluir > 24h"
                    className="flex items-center justify-center p-2 rounded-lg border border-amber-800/30 text-amber-900 hover:bg-amber-100/50 transition-colors cursor-pointer"
                  >
                    <Clock className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={handleDeleteAllReports}
                    title="Limpar Tudo"
                    className="flex items-center justify-center p-2 rounded-lg border border-red-800/30 text-red-900 hover:bg-red-100/50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Lista de Relatórios */}
              <div className="space-y-2">
                {filteredReports.length === 0 ? (
                  <div className="text-center py-8 text-emerald-900/50 text-xs font-bold bg-white/30 rounded-xl border border-white/5">
                    Nenhum doce (relatório) assado no forno ainda! 🍰
                  </div>
                ) : (
                  filteredReports.map(report => {
                    const severity = getReportSeverity(report)
                    const badgeColor = severity === 'critical' ? 'text-red-750 font-extrabold' : severity === 'high' ? 'text-orange-700 font-bold' : severity === 'medium' ? 'text-yellow-700 font-bold' : 'text-green-700'
                    return (
                      <div 
                        key={report.name}
                        onClick={() => {
                          setSelectedReport(report)
                          const globalWindow = window as any
                          if (globalWindow.electron) {
                            globalWindow.electron.ipcRenderer.invoke('read-report', report.path).then((res: any) => {
                              if (res && res.type === 'html') {
                                globalWindow.electron.ipcRenderer.invoke('open-report-file', report.path)
                              }
                            })
                          }
                        }}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-white/40 border border-white/20 hover:bg-white/65 hover:border-emerald-800/20 transition-all cursor-pointer animate-fadeIn"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-950/5 flex items-center justify-center text-emerald-900">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-emerald-950 truncate block max-w-[400px]">{report.name}</span>
                            <span className="text-[10px] text-emerald-900/50 block mt-0.5">{new Date(report.modified).toLocaleString()} | {(report.size / 1024).toFixed(1)} KB</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] uppercase font-mono px-2 py-0.5 bg-white/50 border border-emerald-800/10 rounded ${badgeColor}`}>{severity}</span>
                          <span className="text-[10px] font-black text-emerald-900 bg-emerald-900/10 px-2.5 py-1 rounded-full uppercase">{report.tool}</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {view === 'settings' && (
            <div className="space-y-4 pr-1.5 py-1 bg-white/50 backdrop-blur-sm p-5 rounded-xl border border-emerald-850/10 animate-fadeIn text-emerald-950">
              {/* Cabeçalho */}
              <div>
                <h1 className="text-2xl font-black text-white flex items-center gap-2 drop-shadow-[0_2px_4px_rgba(37,21,13,0.95)]">
                  🍬 Configurações de Estética
                </h1>
                <p className="text-xs text-[#ffd1dc] font-extrabold uppercase tracking-wider mt-1 drop-shadow-[0_1.5px_2px_rgba(37,21,13,0.95)]">
                  Altere temas e realize limpezas na cozinha do toolkit
                </p>
              </div>

              <div className="border-t border-emerald-800/10 pt-4">
                <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-emerald-900" /> Temas Visuais
                </h3>
                <div className="flex gap-2">
                  {[
                    { id: 'cyan', name: '🩵 Ciano Cyberpunk' },
                    { id: 'green', name: '💚 Verde Terminal' },
                    { id: 'purple', name: '💜 Roxo Espacial' },
                    { id: 'candy', name: '🍰 Doces de Candy' },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id as any)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer
                        ${theme === t.id 
                          ? 'bg-[#ff80ab]/20 border-[#ff80ab]/40 text-[#25150d] shadow-[0_0_12px_rgba(255,128,171,0.25)] font-black scale-102' 
                          : 'bg-white/40 border-emerald-800/10 text-emerald-900 hover:bg-white/60'}`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-emerald-800/10 pt-4">
                <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4 text-emerald-900" /> Limpeza de Cozinha
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={handleDeleteAllReports}
                    className="px-3.5 py-2 bg-red-150 border border-red-200 text-red-800 hover:bg-red-200 rounded-xl text-xs font-black transition-all cursor-pointer"
                  >
                    Excluir Todos os Relatórios
                  </button>
                  <button 
                    onClick={handleDeleteOldReports}
                    className="px-3.5 py-2 bg-amber-100 border border-amber-200 text-amber-800 hover:bg-amber-200 rounded-xl text-xs font-black transition-all cursor-pointer"
                  >
                    Apagar Relatórios {'>'} 24 horas
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

      </div>
    </div>
  )
}
