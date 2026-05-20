# Force UTF-8 output so Vietnamese/Unicode characters are preserved
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Use Win32 API EnumWindows with explicit Unicode (W) variants
Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class WindowEnumerator {
    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowTextW(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowTextLengthW(IntPtr hWnd);

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public static List<string> GetAllWindowTitles() {
        var titles = new List<string>();
        EnumWindows((hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
                int length = GetWindowTextLengthW(hWnd);
                if (length > 0) {
                    var sb = new StringBuilder(length + 1);
                    GetWindowTextW(hWnd, sb, sb.Capacity);
                    string title = sb.ToString();
                    if (!string.IsNullOrWhiteSpace(title)) {
                        titles.Add(title);
                    }
                }
            }
            return true;
        }, IntPtr.Zero);
        return titles;
    }
}
"@

$titles = [WindowEnumerator]::GetAllWindowTitles()
foreach ($t in $titles) {
    Write-Output "TITLE:$t"
}

# Check DNS cache for YouTube background streaming
try {
    $dnsCache = Get-DnsClientCache -ErrorAction SilentlyContinue |
        Where-Object { $_.Entry -match 'youtube|googlevideo|ytimg' } |
        Select-Object -First 1

    if ($dnsCache) {
        Write-Output "NET:youtube_dns_cached"
    }
} catch {}
