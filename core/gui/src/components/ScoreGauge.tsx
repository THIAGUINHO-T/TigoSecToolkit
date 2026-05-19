import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface Props {
  value: number      // 0-100
  label: string
  size?: number
  strokeWidth?: number
  color?: string
}

export default function ScoreGauge({ value, label, size = 120, strokeWidth = 8, color }: Props) {
  const [animatedValue, setAnimatedValue] = useState(0)

  useEffect(() => {
    const timeout = setTimeout(() => setAnimatedValue(value), 100)
    return () => clearTimeout(timeout)
  }, [value])

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (animatedValue / 100) * circumference

  const getColor = () => {
    if (color) return color
    if (animatedValue >= 90) return '#00e676'
    if (animatedValue >= 50) return '#ffea00'
    return '#ff1744'
  }

  const scoreColor = getColor()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-2"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1e1e3a"
            strokeWidth={strokeWidth}
          />
          {/* Score ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="gauge-ring"
            stroke={scoreColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              filter: `drop-shadow(0 0 6px ${scoreColor}44)`,
            }}
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-2xl font-bold font-mono"
            style={{ color: scoreColor, textShadow: `0 0 10px ${scoreColor}44` }}
          >
            {animatedValue}
          </span>
        </div>
      </div>
      <span className="text-xs text-cyber-muted font-medium uppercase tracking-wider">{label}</span>
    </motion.div>
  )
}
