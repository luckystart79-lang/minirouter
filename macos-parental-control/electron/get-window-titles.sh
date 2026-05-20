#!/bin/bash
# macOS equivalent of get-window-titles.ps1
# Uses osascript (AppleScript) to enumerate all window titles from all apps

# Part 1: Get ALL window titles from ALL visible applications
osascript -e '
tell application "System Events"
    set allTitles to {}
    set allProcs to every process whose visible is true
    repeat with p in allProcs
        set pName to name of p
        try
            set wins to every window of p
            repeat with w in wins
                set wTitle to name of w
                if wTitle is not "" then
                    set end of allTitles to "TITLE:" & wTitle & " - " & pName
                end if
            end repeat
        end try
    end repeat
    return allTitles
end tell
' 2>/dev/null | tr ',' '\n' | sed 's/^ *//'

# Part 2: Check for YouTube network activity via DNS cache
if host -t A www.youtube.com 2>/dev/null | grep -q "has address"; then
    # Check if there's an active connection to YouTube
    if lsof -i -n 2>/dev/null | grep -qi "googlevideo\|youtube"; then
        echo "NET:youtube_stream_active"
    fi
fi
