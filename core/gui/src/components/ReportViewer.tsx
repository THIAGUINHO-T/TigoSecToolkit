import { useState, useEffect } from 'react'
import { X, ExternalLink, Loader2, Code2, LayoutTemplate } from 'lucide-react'
import type { ReportFile } from '../types'
import SnykRenderer from './renderers/SnykRenderer'
import SemgrepRenderer from './renderers/SemgrepRenderer'
import DepcheckRenderer from './renderers/DepcheckRenderer'
import K6Renderer from './renderers/K6Renderer'
import ObservatoryRenderer from './renderers/ObservatoryRenderer'
import TrufflehogRenderer from './renderers/TrufflehogRenderer'

interface Props {
  report: ReportFile
  onClose: () => void
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

export default function ReportViewer({ report, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState<any>(null)
  const [type, setType] = useState<'json' | 'html' | 'error'>('json')
  const [viewMode, setViewMode] = useState<'visual' | 'raw'>('visual')

  const hasRenderer = ['snyk', 'semgrep', 'depcheck', 'k6', 'observatory', 'trufflehog'].includes(report.tool)

  useEffect(() => {
    setLoading(true)
    window.api.readReport(report.path).then((res: any) => {
      setType(res.type)
      setContent(res.data)
      setLoading(false)
    })
  }, [report.path])

  const formatJSON = (data: any) => {
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch {
        return data
      }
    }
    return JSON.stringify(data, null, 2)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 md:p-8 animate-in fade-in duration-200">
      <div className="w-full max-w-6xl h-[90vh] flex flex-col bg-[#0a0a10] border border-cyber-border/50 rounded-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyber-border/50 bg-black/40">
          <div>
            <h2 className="text-sm font-medium text-white flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${
                report.category.includes('Secrets') ? 'bg-cyber-red' :
                report.category.includes('Codigo') ? 'bg-cyber-violet' :
                report.category.includes('Frontend') ? 'bg-cyber-cyan' :
                'bg-cyber-green'
              }`} />
              <span className={`badge uppercase tracking-wider ${getToolColor(report.tool)}`}>{report.tool}</span>
              <span className="font-mono">
                {report.name.replace(/-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.(json|html)$/, '').replace('-', ' ')}
              </span>
            </h2>
            <p className="text-xs text-cyber-muted mt-1 ml-14">
              {new Date(report.modified).toLocaleString('pt-BR')}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.api.openReportFile(report.path)}
              className="p-2 text-cyber-muted hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Abrir no Sistema</span>
            </button>
            <div className="w-px h-6 bg-cyber-border/50 mx-2" />
            
            {type === 'json' && hasRenderer && (
              <div className="flex bg-black/50 rounded-lg p-1 border border-cyber-border/30 mr-2">
                <button
                  onClick={() => setViewMode('visual')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'visual' ? 'bg-cyber-cyan/20 text-cyber-cyan' : 'text-cyber-muted hover:text-white'
                  }`}
                >
                  <LayoutTemplate className="w-4 h-4" />
                  Visual
                </button>
                <button
                  onClick={() => setViewMode('raw')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'raw' ? 'bg-cyber-cyan/20 text-cyber-cyan' : 'text-cyber-muted hover:text-white'
                  }`}
                >
                  <Code2 className="w-4 h-4" />
                  JSON
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 text-cyber-muted hover:text-white hover:bg-cyber-red/20 hover:text-cyber-red rounded-lg transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto relative">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-cyber-muted">
              <Loader2 className="w-8 h-8 animate-spin text-cyber-cyan mb-4" />
              <p className="text-sm">Carregando conteúdo do relatório...</p>
            </div>
          ) : type === 'html' ? (
            <iframe
              srcDoc={content}
              className="w-full h-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin"
              title="Lighthouse Report"
            />
          ) : type === 'error' ? (
            <div className="p-8">
              <div className="p-4 rounded-lg bg-cyber-red/10 border border-cyber-red/30">
                <p className="text-cyber-red font-mono text-sm break-all">
                  ❌ Falha ao carregar arquivo:<br/><br/>
                  {content}
                </p>
              </div>
            </div>
          ) : viewMode === 'visual' && hasRenderer ? (
            report.tool === 'snyk' ? <SnykRenderer data={content} /> :
            report.tool === 'semgrep' ? <SemgrepRenderer data={content} /> :
            report.tool === 'depcheck' ? <DepcheckRenderer data={content} /> :
            report.tool === 'k6' ? <K6Renderer data={content} /> :
            report.tool === 'observatory' ? <ObservatoryRenderer data={content} /> :
            report.tool === 'trufflehog' ? <TrufflehogRenderer data={content} /> :
            null
          ) : (
            <pre className="p-6 text-[13px] font-mono text-cyber-cyan/90 whitespace-pre-wrap break-words leading-relaxed">
              {formatJSON(content)}
            </pre>
          )}
        </div>

      </div>
    </div>
  )
}
