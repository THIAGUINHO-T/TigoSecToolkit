// Tipagem da API exposta pelo preload.js
export interface ElectronAPI {
  selectDirectory: () => Promise<string | null>
  detectProject: (dir: string) => Promise<ProjectInfo>
  checkTools: () => Promise<Record<string, boolean>>
  runSetup: (toolId?: string) => Promise<boolean>
  updateTitleBarTheme: (themeName: string) => Promise<boolean>
  snykAuth: () => Promise<{ success: boolean; output: string }>
  snykStatus: () => Promise<{ authenticated: boolean; user: string | null }>
  startScan: (config: ScanConfig) => void
  abortScan: () => void
  onScanLog: (cb: (data: LogEntry) => void) => () => void
  onToolStart: (cb: (data: ToolEvent) => void) => () => void
  onToolComplete: (cb: (data: ToolResult) => void) => () => void
  onScanComplete: (cb: (data: { aborted: boolean }) => void) => () => void
  onScanError: (cb: (data: { message: string }) => void) => () => void
  onSetupLog: (cb: (data: string) => void) => () => void
  listReports: () => Promise<ReportFile[]>
  readReport: (path: string) => Promise<{ type: string; data: any }>
  openReportFile: (path: string) => void
  deleteAllReports: () => Promise<boolean>
  deleteOldReports: () => Promise<boolean>
  exportReportsAsMarkdown: (paths: string[]) => Promise<string>
}

export interface ProjectInfo {
  hasPackageJson: boolean
  frameworks: string[]
  language: string[]
  hasGit: boolean
  hasPrisma: boolean
  hasDocker: boolean
  packageJson: { name?: string; version?: string } | null
  error?: string
}

export interface ScanConfig {
  tools: string[]
  projectDir: string
  url?: string
}

export interface LogEntry {
  toolId: string
  line: string
  stream: 'stdout' | 'stderr'
}

export interface ToolEvent {
  toolId: string
  index: number
  total: number
}

export interface ToolResult {
  toolId: string
  success: boolean
  error?: string
  index: number
}

export interface ReportFile {
  name: string
  tool: string
  category: string
  size: number
  modified: string
  path: string
  summary?: any
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
