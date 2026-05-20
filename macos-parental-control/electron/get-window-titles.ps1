# Part 1: Scan ALL window titles (catches any browser - Opera, Brave, Vivaldi, Arc, etc.)
$titles = Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -ExpandProperty MainWindowTitle
foreach ($t in $titles) {
    Write-Output "TITLE:$t"
}

# Part 2: Quick DNS cache check for YouTube domains
# Much faster than reverse-looking up every TCP connection
try {
    $dnsCache = Get-DnsClientCache -ErrorAction SilentlyContinue |
        Where-Object { $_.Entry -match 'youtube|googlevideo|ytimg' } |
        Select-Object -First 1

    if ($dnsCache) {
        Write-Output "NET:youtube_dns_cached"
    }
} catch {
    # Fallback: skip network check
}
