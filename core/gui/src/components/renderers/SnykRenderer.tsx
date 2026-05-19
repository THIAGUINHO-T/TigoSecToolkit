import { Package, ShieldAlert, ArrowRight } from 'lucide-react'

export default function SnykRenderer({ data }: { data: any }) {
  const vulns = data.vulnerabilities || []

  if (vulns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-cyber-muted">
        <ShieldCheck className="w-12 h-12 text-cyber-green mb-4" />
        <p>Nenhuma vulnerabilidade de dependência detectada pelo Snyk!</p>
      </div>
    )
  }

  // Agrupar vulnerabilidades pelo nome do pacote para facilitar a leitura
  const byPackage = vulns.reduce((acc: any, v: any) => {
    if (!acc[v.packageName]) acc[v.packageName] = []
    acc[v.packageName].push(v)
    return acc
  }, {})

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-cyber-red" />
          Vulnerabilidades Encontradas ({vulns.length})
        </h3>
        {data.dependencyCount && (
          <span className="text-sm text-cyber-muted">Total de pacotes: {data.dependencyCount}</span>
        )}
      </div>

      <div className="grid gap-6">
        {Object.entries(byPackage).map(([pkgName, pkgVulns]: [string, any]) => (
          <div key={pkgName} className="border border-cyber-border/50 rounded-lg bg-black/40 p-5">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-cyber-border/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-md">
                  <Package className="w-5 h-5 text-cyber-cyan" />
                </div>
                <div>
                  <h4 className="text-lg font-mono text-white">{pkgName}</h4>
                  <p className="text-xs text-cyber-muted mt-1">
                    Versão atual: <span className="text-cyber-orange">{pkgVulns[0].version}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {pkgVulns.map((v: any, idx: number) => (
                <div key={v.id + idx} className="pl-4 border-l-2 border-cyber-border/30 hover:border-cyber-cyan/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={v.severity} />
                        <span className="text-sm font-medium text-gray-200">{v.title}</span>
                        {v.cvssScore && (
                          <span className="text-[10px] text-cyber-muted font-mono ml-2">CVSS: {v.cvssScore}</span>
                        )}
                      </div>
                      <p className="text-xs text-cyber-muted/80 max-w-3xl line-clamp-2 mt-2">
                        {v.description.replace(/<[^>]*>?/gm, '')} {/* Remove HTML from desc */}
                      </p>
                    </div>
                    
                    {v.fixedIn && v.fixedIn.length > 0 && (
                      <div className="flex-shrink-0 ml-4 flex items-center gap-2 text-xs font-mono bg-cyber-green/10 text-cyber-green border border-cyber-green/30 px-3 py-1.5 rounded">
                        <span>Fix</span>
                        <ArrowRight className="w-3 h-3" />
                        <span>{v.fixedIn[0]}</span>
                      </div>
                    )}
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

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toLowerCase()
  const color = 
    s === 'critical' ? 'bg-cyber-red text-white border-cyber-red' :
    s === 'high' ? 'bg-cyber-orange/20 text-cyber-orange border-cyber-orange/50' :
    s === 'medium' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50' :
    'bg-cyber-blue/20 text-cyber-blue border-cyber-blue/50'

  return (
    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${color}`}>
      {severity}
    </span>
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
