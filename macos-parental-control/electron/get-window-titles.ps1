Get-Process chrome,msedge,firefox -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowTitle -ne '' } |
  Select-Object -ExpandProperty MainWindowTitle
