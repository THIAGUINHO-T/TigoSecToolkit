import { ShieldCheck, ShieldAlert, Shield, CheckCircle2, XCircle, Info } from 'lucide-react'

export default function ObservatoryRenderer({ data }: { data: any }) {
  if (!data || !data.scan || !data.tests) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-cyber-muted">
        <Shield className="w-12 h-12 text-cyber-muted mb-4 opacity-50" />
        <p>Dados do Observatory não encontrados ou inválidos.</p>
      </div>
    )
  }

  const { grade, score } = data.scan
  const tests = Object.values(data.tests) as any[]

  // Determinar cor do grade
  let gradeColor = 'text-cyber-green'
  let gradeBg = 'bg-cyber-green/10 border-cyber-green/30'
  if (['C', 'D'].includes(grade)) {
    gradeColor = 'text-cyber-orange'
    gradeBg = 'bg-cyber-orange/10 border-cyber-orange/30'
  } else if (grade === 'E' || grade === 'F') {
    gradeColor = 'text-cyber-red'
    gradeBg = 'bg-cyber-red/10 border-cyber-red/30'
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      
      {/* Header com a Nota Final */}
      <div className={`flex flex-col md:flex-row items-center justify-between border rounded-xl p-6 ${gradeBg}`}>
        <div className="flex items-center gap-6">
          <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center bg-black/50 ${gradeColor} border-current`}>
            <span className="text-4xl font-black">{grade}</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Mozilla Observatory</h2>
            <p className="text-cyber-muted">Score de Segurança HTTP: <span className="text-white font-mono">{score}/100</span></p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <h3 className="text-lg font-medium text-white mb-2">Testes Avaliados ({tests.length})</h3>
        
        {tests.sort((a, b) => a.pass === b.pass ? 0 : a.pass ? 1 : -1).map((test, idx) => {
          const isPass = test.pass === true
          const isFail = test.pass === false
          const isWarning = test.pass === null // Muitas vezes null significa opcional/info

          const Icon = isPass ? CheckCircle2 : isFail ? XCircle : Info
          const colorClass = isPass ? 'text-cyber-green' : isFail ? 'text-cyber-red' : 'text-cyber-blue'
          const bgClass = isPass ? 'bg-cyber-green/5 border-cyber-green/20' : isFail ? 'bg-cyber-red/5 border-cyber-red/20' : 'bg-cyber-blue/5 border-cyber-blue/20'

          return (
            <div key={idx} className={`border rounded-lg p-4 flex gap-4 ${bgClass}`}>
              <div className={`mt-1 flex-shrink-0 ${colorClass}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className={`font-semibold ${isFail ? 'text-white' : 'text-gray-300'}`}>{test.title}</h4>
                  {test.score_modifier !== 0 && (
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${test.score_modifier > 0 ? 'bg-cyber-green/20 text-cyber-green' : 'bg-cyber-red/20 text-cyber-red'}`}>
                      {test.score_modifier > 0 ? '+' : ''}{test.score_modifier} pts
                    </span>
                  )}
                </div>
                {/* O description do Observatory já vem com tags HTML como <p> e <code> */}
                <div 
                  className="text-sm text-cyber-muted/80 leading-relaxed prose prose-invert max-w-none prose-p:my-1 prose-code:text-cyber-cyan prose-code:bg-white/5 prose-code:px-1 prose-code:rounded"
                  dangerouslySetInnerHTML={{ __html: test.score_description }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
