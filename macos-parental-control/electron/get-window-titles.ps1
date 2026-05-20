# Use Win32 API EnumWindows to get ALL visible window titles
# This catches EVERY browser window (multiple windows of same browser)
# Limitation: only sees the active tab per window (tabs are internal browser UI)

Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class WindowEnumerator {
    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern int GetWindowTextLength(IntPtr hWnd);

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public static List<string> GetAllWindowTitles() {
        var titles = new List<string>();
        EnumWindows((hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
                int length = GetWindowTextLength(hWnd);
                if (length > 0) {
                    var sb = new StringBuilder(length + 1);
                    GetWindowText(hWnd, sb, sb.Capacity);
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

# Part 2: Check DNS cache for YouTube background streaming
try {
    $dnsCache = Get-DnsClientCache -ErrorAction SilentlyContinue |
        Where-Object { $_.Entry -match 'youtube|googlevideo|ytimg' } |
        Select-Object -First 1

    if ($dnsCache) {
        Write-Output "NET:youtube_dns_cached"
    }
} catch {}
