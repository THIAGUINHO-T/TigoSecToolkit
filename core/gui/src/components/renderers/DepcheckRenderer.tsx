import { PackageX, AlertCircle, FileWarning } from 'lucide-react'

export default function DepcheckRenderer({ data }: { data: any }) {
  const unusedDeps = data.dependencies || []
  const unusedDevDeps = data.devDependencies || []
  const missingDeps = data.missing || {}
  const missingKeys = Object.keys(missingDeps)

  const hasIssues = unusedDeps.length > 0 || unusedDevDeps.length > 0 || missingKeys.length > 0

  if (!hasIssues) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-cyber-muted">
        <PackageCheck className="w-12 h-12 text-cyber-green mb-4" />
        <p>Dependências do projeto estão limpas e bem configuradas!</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      
      {/* Dependências Faltando (Alta Prioridade) */}
      {missingKeys.length > 0 && (
        <div className="border border-cyber-red/50 rounded-lg overflow-hidden bg-black/40">
          <div className="flex items-center gap-2 px-4 py-3 bg-cyber-red/10 border-b border-cyber-red/30">
            <AlertCircle className="w-5 h-5 text-cyber-red" />
            <h3 className="font-medium text-cyber-red">Dependências Faltando (Não declaradas no package.json)</h3>
          </div>
          <div className="divide-y divide-cyber-border/30">
            {missingKeys.map(dep => (
              <div key={dep} className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <span className="font-mono text-sm text-white bg-white/5 px-2 py-1 rounded border border-white/10 w-48 shrink-0">
                  {dep}
                </span>
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-cyber-muted flex items-center gap-1">
                    <FileWarning className="w-3 h-3" />
                    Usado em:
                  </p>
                  <ul className="list-disc list-inside text-[11px] text-cyber-cyan/80 font-mono">
                    {missingDeps[dep].map((file: string, i: number) => (
                      <li key={i} className="truncate">{file}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Dependencies */}
        {unusedDeps.length > 0 && (
          <div className="border border-cyber-orange/40 rounded-lg overflow-hidden bg-black/40">
            <div className="flex items-center gap-2 px-4 py-3 bg-cyber-orange/5 border-b border-cyber-orange/20">
              <PackageX className="w-4 h-4 text-cyber-orange" />
              <h3 className="font-medium text-cyber-orange">Dependencies Não Usadas</h3>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {unusedDeps.map((dep: string) => (
                  <span key={dep} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-300">
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Dev Dependencies */}
        {unusedDevDeps.length > 0 && (
          <div className="border border-cyber-blue/40 rounded-lg overflow-hidden bg-black/40">
            <div className="flex items-center gap-2 px-4 py-3 bg-cyber-blue/5 border-b border-cyber-blue/20">
              <PackageX className="w-4 h-4 text-cyber-blue" />
              <h3 className="font-medium text-cyber-blue">DevDependencies Não Usadas</h3>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {unusedDevDeps.map((dep: string) => (
                  <span key={dep} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-300">
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

function PackageCheck(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m16 16 2 2 4-4"/>
      <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/>
      <path d="m3.3 7 8.7 5 8.7-5"/>
      <path d="M12 22V12"/>
    </svg>
  )
}
