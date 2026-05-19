import { FileText, AlertTriangle } from 'lucide-react'

export default function SemgrepRenderer({ data }: { data: any }) {
  if (!data || !data.results || data.results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-cyber-muted">
        <ShieldCheck className="w-12 h-12 text-cyber-green mb-4" />
        <p>Nenhuma vulnerabilidade detectada pelo Semgrep!</p>
      </div>
    )
  }

  // Agrupar por arquivo para ficar no estilo Github
  const byFile = data.results.reduce((acc: any, result: any) => {
    const path = result.path
    if (!acc[path]) acc[path] = []
    acc[path].push(result)
    return acc
  }, {})

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-cyber-orange" />
          Problemas Encontrados ({data.results.length})
        </h3>
      </div>

      <div className="space-y-6">
        {Object.entries(byFile).map(([filePath, results]: [string, any]) => (
          <div key={filePath} className="border border-cyber-border/50 rounded-lg overflow-hidden bg-black/40">
            {/* Header (Github style) */}
            <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-cyber-border/50">
              <FileText className="w-4 h-4 text-cyber-muted" />
              <span className="font-mono text-sm text-cyber-cyan/90 break-all">{filePath}</span>
            </div>

            {/* Findings */}
            <div className="divide-y divide-cyber-border/30">
              {results.map((r: any, idx: number) => (
                <div key={idx} className="p-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-16 flex-shrink-0 text-right mt-1">
                      <span className="text-xs font-mono text-cyber-muted">Linha {r.start?.line}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 mb-2 leading-relaxed">{r.extra?.message}</p>
                      <div className="flex items-center gap-2">
                        <span className="badge border border-cyber-border/50 text-[10px] text-cyber-muted uppercase bg-black/50">
                          {r.check_id}
                        </span>
                        <span className={`badge text-[10px] uppercase ${
                          r.extra?.severity === 'ERROR' ? 'bg-cyber-red/20 text-cyber-red border border-cyber-red/30' :
                          r.extra?.severity === 'WARNING' ? 'bg-cyber-orange/20 text-cyber-orange border border-cyber-orange/30' :
                          'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/30'
                        }`}>
                          {r.extra?.severity}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ShieldCheck(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  )
}
