import { Activity, Clock, XCircle, CheckCircle2 } from 'lucide-react'

export default function K6Renderer({ data }: { data: any[] }) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-cyber-muted">
        <Activity className="w-12 h-12 text-cyber-muted mb-4 opacity-50" />
        <p>Dados do k6 não encontrados ou inválidos.</p>
      </div>
    )
  }

  // Agrupar métricas
  const metrics: Record<string, number[]> = {}
  data.forEach((entry: any) => {
    if (entry.type === 'Point' && entry.metric && entry.data) {
      if (!metrics[entry.metric]) metrics[entry.metric] = []
      metrics[entry.metric].push(entry.data.value)
    }
  })

  const reqs = metrics['http_reqs'] || []
  const durations = metrics['http_req_duration'] || []
  const failures = metrics['http_req_failed'] || []

  const totalReqs = reqs.length
  
  // Calcular p95, avg, max
  let avg = 0, p95 = 0, max = 0
  if (durations.length > 0) {
    avg = durations.reduce((a, b) => a + b, 0) / durations.length
    max = Math.max(...durations)
    const sorted = [...durations].sort((a, b) => a - b)
    p95 = sorted[Math.floor(sorted.length * 0.95)]
  }

  // Taxa de erros
  let failRate = 0
  if (failures.length > 0) {
    const totalFails = failures.filter(v => v > 0).length
    failRate = (totalFails / failures.length) * 100
  }

  const p95Ok = p95 < 2000
  const failsOk = failRate < 5

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyber-cyan" />
          Métricas de Performance (k6)
        </h3>
        <span className="text-sm font-mono text-cyber-muted bg-white/5 px-3 py-1 rounded-full border border-white/10">
          Total Requisições: {totalReqs}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Tempo de Resposta (P95) */}
        <div className="border border-cyber-border/50 rounded-lg p-5 bg-black/40 flex items-start gap-4">
          <div className={`p-3 rounded-xl ${p95Ok ? 'bg-cyber-green/10 text-cyber-green' : 'bg-cyber-red/10 text-cyber-red'}`}>
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-cyber-muted font-medium mb-1">Tempo de Resposta (P95)</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold font-mono ${p95Ok ? 'text-white' : 'text-cyber-red'}`}>
                {p95.toFixed(0)} <span className="text-base text-cyber-muted font-normal">ms</span>
              </span>
            </div>
            <p className="text-xs text-cyber-muted mt-2">
              95% das requisições foram mais rápidas que isso. 
              {p95Ok ? <span className="text-cyber-green ml-1">Ideal &lt; 2000ms</span> : <span className="text-cyber-red ml-1">Acima do ideal (&lt; 2000ms)</span>}
            </p>
          </div>
        </div>

        {/* Taxa de Erros */}
        <div className="border border-cyber-border/50 rounded-lg p-5 bg-black/40 flex items-start gap-4">
          <div className={`p-3 rounded-xl ${failsOk ? 'bg-cyber-green/10 text-cyber-green' : 'bg-cyber-red/10 text-cyber-red'}`}>
            {failsOk ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
          </div>
          <div>
            <p className="text-sm text-cyber-muted font-medium mb-1">Taxa de Erros HTTP</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold font-mono ${failsOk ? 'text-white' : 'text-cyber-red'}`}>
                {failRate.toFixed(1)} <span className="text-base text-cyber-muted font-normal">%</span>
              </span>
            </div>
            <p className="text-xs text-cyber-muted mt-2">
              Porcentagem de requisições que retornaram erro.
              {failsOk ? <span className="text-cyber-green ml-1">Ideal &lt; 5%</span> : <span className="text-cyber-red ml-1">Acima do limite aceitável (&lt; 5%)</span>}
            </p>
          </div>
        </div>

        {/* Média */}
        <div className="border border-cyber-border/50 rounded-lg p-5 bg-black/40 flex items-start gap-4">
          <div className="p-3 rounded-xl bg-cyber-blue/10 text-cyber-blue">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-cyber-muted font-medium mb-1">Tempo Médio</p>
            <span className="text-2xl font-bold font-mono text-white">
              {avg.toFixed(0)} <span className="text-base text-cyber-muted font-normal">ms</span>
            </span>
          </div>
        </div>

        {/* Máxima */}
        <div className="border border-cyber-border/50 rounded-lg p-5 bg-black/40 flex items-start gap-4">
          <div className="p-3 rounded-xl bg-cyber-orange/10 text-cyber-orange">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-cyber-muted font-medium mb-1">Tempo Máximo</p>
            <span className="text-2xl font-bold font-mono text-white">
              {max.toFixed(0)} <span className="text-base text-cyber-muted font-normal">ms</span>
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}
