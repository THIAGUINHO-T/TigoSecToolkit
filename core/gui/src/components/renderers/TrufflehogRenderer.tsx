import { KeyRound, ShieldCheck, FileKey, AlertOctagon, CheckCircle2 } from 'lucide-react'

export default function TrufflehogRenderer({ data }: { data: any[] }) {
  if (!Array.isArray(data)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-cyber-muted">
        <KeyRound className="w-12 h-12 text-cyber-muted mb-4 opacity-50" />
        <p>Dados do Trufflehog inválidos ou não disponíveis.</p>
      </div>
    )
  }

  // Trufflehog mistura logs de execução com os findings reais.
  // Findings reais têm a chave "DetectorName" ou "SourceMetadata".
  const findings = data.filter((entry: any) => entry.DetectorName || entry.Raw || entry.SourceMetadata)

  if (findings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-cyber-muted">
        <ShieldCheck className="w-12 h-12 text-cyber-green mb-4" />
        <p>Nenhum segredo ou credencial vazada encontrada pelo Trufflehog!</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <AlertOctagon className="w-5 h-5 text-cyber-red" />
          Credenciais Expostas ({findings.length})
        </h3>
      </div>

      <div className="grid gap-6">
        {findings.map((f: any, idx: number) => {
          // Extrair arquivo e linha (pode estar no Git ou no Filesystem dependendo de como rodou)
          const sourceData = f.SourceMetadata?.Data || {}
          const gitData = sourceData.Git || {}
          const fsData = sourceData.Filesystem || {}
          
          const filePath = gitData.file || fsData.file || 'Arquivo Desconhecido'
          const lineNum = gitData.line || fsData.line || '?'
          const commit = gitData.commit || null

          return (
            <div key={idx} className="border border-cyber-red/30 rounded-lg overflow-hidden bg-black/40">
              
              {/* Header do Finding */}
              <div className="flex items-center gap-2 px-4 py-3 bg-cyber-red/10 border-b border-cyber-red/30">
                <FileKey className="w-4 h-4 text-cyber-red" />
                <span className="font-mono text-sm text-gray-200 truncate flex-1">{filePath}</span>
                <span className="text-xs font-mono text-cyber-muted bg-black/50 px-2 py-1 rounded">
                  Linha {lineNum}
                </span>
              </div>

              {/* Corpo */}
              <div className="p-5 space-y-4">
                
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-semibold text-white">Detector:</span>
                      <span className="badge bg-cyber-orange/20 text-cyber-orange border border-cyber-orange/30">
                        {f.DetectorName || 'Desconhecido'}
                      </span>
                      
                      {f.Verified ? (
                        <span className="badge bg-cyber-red/20 text-cyber-red border border-cyber-red/30 flex items-center gap-1">
                          <AlertOctagon className="w-3 h-3" /> Verificado (Ativo!)
                        </span>
                      ) : (
                        <span className="badge bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Não Verificado
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Exibição do Segredo */}
                <div className="bg-black/60 border border-cyber-border/40 rounded p-3 font-mono text-xs overflow-x-auto">
                  <p className="text-cyber-muted mb-1 select-none">Segredo Capturado:</p>
                  <p className="text-cyber-red/90 break-all select-all">
                    {f.Redacted || f.Raw || '---'}
                  </p>
                </div>

                {commit && (
                  <p className="text-xs text-cyber-muted font-mono">
                    Commit associado: <span className="text-cyber-cyan">{commit}</span>
                  </p>
                )}
                
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
