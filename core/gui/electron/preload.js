const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // ── Diálogos ──
  selectDirectory: () => ipcRenderer.invoke('select-directory'),

  // ── Projeto ──
  detectProject: (dir) => ipcRenderer.invoke('detect-project', dir),

  // ── Ferramentas ──
  checkTools: () => ipcRenderer.invoke('check-tools'),
  runSetup: (toolId) => ipcRenderer.invoke('run-setup', toolId),
  updateTitleBarTheme: (themeName) => ipcRenderer.invoke('update-titlebar-theme', themeName),

  // ── Snyk ──
  snykAuth: () => ipcRenderer.invoke('snyk-auth'),
  snykStatus: () => ipcRenderer.invoke('snyk-status'),

  // ── Scan ──
  startScan: (config) => ipcRenderer.send('start-scan', config),
  abortScan: () => ipcRenderer.send('abort-scan'),

  onScanLog:      (cb) => { ipcRenderer.on('scan-log', (_e, data) => cb(data));      return () => ipcRenderer.removeAllListeners('scan-log') },
  onToolStart:    (cb) => { ipcRenderer.on('tool-start', (_e, data) => cb(data));    return () => ipcRenderer.removeAllListeners('tool-start') },
  onToolComplete: (cb) => { ipcRenderer.on('tool-complete', (_e, data) => cb(data)); return () => ipcRenderer.removeAllListeners('tool-complete') },
  onScanComplete: (cb) => { ipcRenderer.on('scan-complete', (_e, data) => cb(data)); return () => ipcRenderer.removeAllListeners('scan-complete') },
  onScanError:    (cb) => { ipcRenderer.on('scan-error', (_e, data) => cb(data));    return () => ipcRenderer.removeAllListeners('scan-error') },
  onSetupLog:     (cb) => { ipcRenderer.on('setup-log', (_e, data) => cb(data));     return () => ipcRenderer.removeAllListeners('setup-log') },

  // ── Relatórios ──
  listReports: () => ipcRenderer.invoke('list-reports'),
  readReport:  (filePath) => ipcRenderer.invoke('read-report', filePath),
  openReportFile: (filePath) => ipcRenderer.invoke('open-report-file', filePath),
  deleteAllReports: () => ipcRenderer.invoke('delete-all-reports'),
  deleteOldReports: () => ipcRenderer.invoke('delete-old-reports'),
  exportReportsAsMarkdown: (paths) => ipcRenderer.invoke('export-reports-markdown', paths)
})
