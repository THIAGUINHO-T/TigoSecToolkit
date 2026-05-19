import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { LogEntry } from '../types'

interface Props {
  logs: LogEntry[]
  isRunning: boolean
  currentTool: string
}

export default function TerminalViewer({ logs, isRunning, currentTool }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll para o final
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs])

  const classifyLine = (line: string): string => {
    if (line.includes('✅') || line.includes('Nenhum')) return 'success'
    if (line.includes('❌') || line.includes('ERRO') || line.includes('Error')) return 'stderr'
    if (line.includes('⚠️') || line.includes('WARNING')) return 'warning'
    if (line.includes('🔍') || line.includes('🛡') || line.includes('🔬') || line.includes('💡') || line.includes('⚡')) return 'header'
    if (line.includes('ℹ️') || line.includes('📄') || line.includes('📊')) return 'info'
    return 'stdout'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-cyber-muted uppercase tracking-wider">Terminal</h2>
          {isRunning && currentTool && (
            <span className="badge badge-info animate-pulse">{currentTool}</span>
          )}
        </div>
        <span className="text-xs font-mono text-cyber-muted/50">{logs.length} linhas</span>
      </div>

      <div ref={containerRef} className="terminal max-h-80 overflow-y-auto">
        {/* Scan line overlay */}
        {isRunning && <div className="scan-overlay" />}

        {logs.length === 0 && isRunning && (
          <div className="terminal-line info">Iniciando análise...</div>
        )}

        {logs.map((log, i) => (
          <div
            key={i}
            className={`terminal-line ${log.stream === 'stderr' ? 'stderr' : classifyLine(log.line)}`}
          >
            {log.line}
          </div>
        ))}

        {isRunning && (
          <div className="terminal-line info animate-pulse">▌</div>
        )}
      </div>
    </motion.div>
  )
}
