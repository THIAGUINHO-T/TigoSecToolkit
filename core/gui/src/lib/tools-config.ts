import { Shield, GitBranch, Search, Package, CircleDot, Bug, Radar, Gauge, Globe, Zap } from 'lucide-react'

export interface ToolConfig {
  id: string
  name: string
  description: string
  category: 'secrets' | 'code' | 'deps' | 'frontend' | 'load'
  icon: any
  needsUrl: boolean
  needsGit: boolean
  urlLabel?: string
}

export const TOOL_CATEGORIES = {
  secrets:  { label: 'Secrets & Credenciais', color: '#ff1744' },
  code:     { label: 'Código-fonte',          color: '#8b5cf6' },
  deps:     { label: 'Dependências & CVEs',   color: '#ff9100' },
  frontend: { label: 'Frontend & HTTP',       color: '#00f0ff' },
  load:     { label: 'Carga & Estabilidade',  color: '#00e676' },
}

export const TOOLS: ToolConfig[] = [
  {
    id: 'gitleaks',
    name: 'Gitleaks',
    description: 'Detecta secrets e credenciais expostas no histórico git',
    category: 'secrets',
    icon: GitBranch,
    needsUrl: false,
    needsGit: true,
  },
  {
    id: 'trufflehog',
    name: 'Trufflehog',
    description: 'Varredura profunda de secrets com verificação de entropia',
    category: 'secrets',
    icon: Search,
    needsUrl: false,
    needsGit: true,
  },
  {
    id: 'semgrep',
    name: 'Semgrep',
    description: 'Análise estática de código em busca de vulnerabilidades (OWASP)',
    category: 'code',
    icon: Shield,
    needsUrl: false,
    needsGit: false,
  },
  {
    id: 'depcheck',
    name: 'Depcheck',
    description: 'Identifica dependências não utilizadas no projeto',
    category: 'code',
    icon: Package,
    needsUrl: false,
    needsGit: false,
  },
  {
    id: 'madge',
    name: 'Madge',
    description: 'Mapeia e detecta dependências circulares entre módulos',
    category: 'code',
    icon: CircleDot,
    needsUrl: false,
    needsGit: false,
  },
  {
    id: 'snyk',
    name: 'Snyk',
    description: 'Verifica CVEs conhecidos nas dependências do projeto',
    category: 'deps',
    icon: Bug,
    needsUrl: false,
    needsGit: false,
  },
  {
    id: 'nuclei',
    name: 'Nuclei',
    description: 'Scanner de CVEs conhecidos nas rotas da API',
    category: 'deps',
    icon: Radar,
    needsUrl: true,
    needsGit: false,
    urlLabel: 'URL da API para scan',
  },
  {
    id: 'lighthouse',
    name: 'Lighthouse',
    description: 'Audita performance, acessibilidade, SEO e segurança do frontend',
    category: 'frontend',
    icon: Gauge,
    needsUrl: true,
    needsGit: false,
    urlLabel: 'URL do frontend',
  },
  {
    id: 'observatory',
    name: 'Observatory',
    description: 'Analisa headers HTTP de segurança (Mozilla Observatory)',
    category: 'frontend',
    icon: Globe,
    needsUrl: true,
    needsGit: false,
    urlLabel: 'URL pública do site',
  },
  {
    id: 'k6',
    name: 'k6',
    description: 'Teste de carga e estabilidade com usuários simultâneos',
    category: 'load',
    icon: Zap,
    needsUrl: true,
    needsGit: false,
    urlLabel: 'URL para teste de carga',
  },
]
