// ===========================================================
// 9Router Remote Bridge — VS Code / Antigravity Extension
// ===========================================================
const vscode = require('vscode');
const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');

let _server = null;
let _port = 3848;
let _statusBarItem = null;
let _lastPrompt = '';
let _promptCount = 0;

// Prompt queue: each item has {prompt, targetWorkspace (optional)}
let _promptQueue = [];
// Track connected windows: {workspace -> {title, lastPoll}}
let _connectedWindows = {};
let _rendererReport = null;

const INJECT_TAG_START = '<!-- 9ROUTER-BRIDGE-START -->';
const INJECT_TAG_END = '<!-- 9ROUTER-BRIDGE-END -->';

function getWorkbenchPath() {
    const appRoot = vscode.env.appRoot;
    const candidates = [
        path.join(appRoot, 'out', 'vs', 'code', 'electron-browser', 'workbench', 'workbench.html'),
        path.join(appRoot, 'out', 'vs', 'code', 'electron-sandbox', 'workbench', 'workbench.html'),
        path.join(appRoot, 'out', 'vs', 'workbench', 'workbench.html'),
        path.join(appRoot, 'out', 'vs', 'code', 'browser', 'workbench', 'workbench.html'),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

function isScriptInjected() {
    try {
        const wbPath = getWorkbenchPath();
        if (!wbPath) return false;
        const html = fs.readFileSync(wbPath, 'utf8');
        return html.includes(INJECT_TAG_START) && html.includes(INJECT_TAG_END);
    } catch (_) { return false; }
}

function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// ===========================================================
// HTTP SERVER — workspace-aware prompt routing
// ===========================================================
function startServer() {
    if (_server) return;
    const cfg = vscode.workspace.getConfiguration('9router-bridge');
    _port = cfg.get('port', 3848);

    _server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

        const parsed = url.parse(req.url, true);

        // GET /bridge-poll?workspace=xxx&title=xxx
        if (req.method === 'GET' && parsed.pathname === '/bridge-poll') {
            const workspace = parsed.query.workspace || '';
            const title = parsed.query.title || '';

            // Track this window
            if (workspace) {
                _connectedWindows[workspace] = { title, lastPoll: Date.now() };
            }

            // Find a matching prompt for this workspace
            let prompt = null;
            let scanDom = false;

            for (let i = 0; i < _promptQueue.length; i++) {
                const item = _promptQueue[i];
                if (!item.targetWorkspace) {
                    // No target — deliver to first poller
                    prompt = item.prompt;
                    _promptQueue.splice(i, 1);
                    break;
                }
                // Match workspace name (case-insensitive partial match)
                const target = item.targetWorkspace.toLowerCase();
                const ws = workspace.toLowerCase();
                const t = title.toLowerCase();
                if (ws.includes(target) || t.includes(target)) {
                    prompt = item.prompt;
                    _promptQueue.splice(i, 1);
                    break;
                }
            }

            res.writeHead(200);
            return res.end(JSON.stringify({ prompt, scanDom }));
        }

        // GET /status
        if (req.method === 'GET' && parsed.pathname === '/status') {
            // Clean stale windows (no poll in 10s)
            const now = Date.now();
            for (const ws in _connectedWindows) {
                if (now - _connectedWindows[ws].lastPoll > 10000) delete _connectedWindows[ws];
            }
            res.writeHead(200);
            return res.end(JSON.stringify({
                ok: true, injected: isScriptInjected(), port: _port,
                promptCount: _promptCount, lastPrompt: _lastPrompt.substring(0, 50),
                pendingPrompts: _promptQueue.length,
                connectedWindows: _connectedWindows,
                rendererReport: _rendererReport
            }));
        }

        // GET /windows — list connected windows
        if (req.method === 'GET' && parsed.pathname === '/windows') {
            const now = Date.now();
            const windows = {};
            for (const ws in _connectedWindows) {
                if (now - _connectedWindows[ws].lastPoll < 10000) {
                    windows[ws] = _connectedWindows[ws];
                }
            }
            res.writeHead(200);
            return res.end(JSON.stringify({ windows }));
        }

        // POST /bridge-report — renderer reports back
        if (req.method === 'POST' && parsed.pathname === '/bridge-report') {
            let body = '';
            req.on('data', c => body += c);
            req.on('end', () => {
                try { _rendererReport = JSON.parse(body); } catch(_) {}
                console.log('[9Router Bridge] Report:', JSON.stringify(_rendererReport).substring(0, 200));
                updateStatusBar();
                res.writeHead(200);
                res.end(JSON.stringify({ ok: true }));
            });
            return;
        }

        // POST /api/send-prompt — agent.js sends prompts here
        // Body: {prompt: "...", targetWorkspace: "9router" (optional)}
        if (req.method === 'POST' && parsed.pathname === '/api/send-prompt') {
            let body = '';
            req.on('data', c => body += c);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (!data.prompt) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Missing prompt' })); }

                    _promptQueue.push({
                        prompt: data.prompt,
                        targetWorkspace: data.targetWorkspace || null,
                        time: Date.now()
                    });
                    _lastPrompt = data.prompt;
                    _promptCount++;
                    updateStatusBar();

                    // Check if target workspace is connected
                    let targetConnected = false;
                    if (data.targetWorkspace) {
                        const target = data.targetWorkspace.toLowerCase();
                        for (const ws in _connectedWindows) {
                            if (ws.toLowerCase().includes(target) && Date.now() - _connectedWindows[ws].lastPoll < 10000) {
                                targetConnected = true;
                                break;
                            }
                        }
                    } else {
                        targetConnected = Object.keys(_connectedWindows).length > 0;
                    }

                    console.log('[9Router Bridge] Prompt queued:', data.prompt.substring(0, 60), '| target:', data.targetWorkspace || 'any', '| connected:', targetConnected);

                    res.writeHead(200);
                    res.end(JSON.stringify({
                        ok: true,
                        targetConnected,
                        connectedWindows: Object.keys(_connectedWindows)
                    }));
                } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
            });
            return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    });

    _server.on('error', (e) => { console.error('[9Router Bridge] Server error:', e.message); });
    _server.listen(_port, '127.0.0.1', () => { console.log('[9Router Bridge] HTTP on port ' + _port); });
}

// ===========================================================
// STATUS BAR
// ===========================================================
function createStatusBar(context) {
    _statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -10100);
    _statusBarItem.command = '9router-bridge.status';
    context.subscriptions.push(_statusBarItem);
    updateStatusBar();
    _statusBarItem.show();
}

function updateStatusBar() {
    if (!_statusBarItem) return;
    const alive = _rendererReport && _rendererReport.event;
    const winCount = Object.keys(_connectedWindows).length;
    _statusBarItem.text = alive ? '$(radio-tower) Bridge OK' : '$(radio-tower) Bridge:' + _port;
    _statusBarItem.tooltip = '9Router Remote Bridge\nPort: ' + _port + '\nPrompts: ' + _promptCount + '\nWindows: ' + winCount + '\nRenderer: ' + (alive ? 'Connected' : 'Waiting');
    _statusBarItem.color = alive ? '#4EC9B0' : '#FFCC66';
}

// ===========================================================
// ACTIVATION
// ===========================================================
function activate(context) {
    console.log('[9Router Bridge] Activating...');
    startServer();

    if (!isScriptInjected()) {
        console.log('[9Router Bridge] Script tag not found in workbench.html');
    }

    createStatusBar(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('9router-bridge.status', () => {
            const winNames = Object.keys(_connectedWindows);
            vscode.window.showInformationMessage(
                '9Router Bridge | Port: ' + _port + ' | Windows: ' + (winNames.length > 0 ? winNames.join(', ') : 'none') + ' | Prompts: ' + _promptCount
            );
        })
    );
}

function deactivate() {
    if (_server) { try { _server.close(); } catch(_) {} _server = null; }
    if (_statusBarItem) { _statusBarItem.dispose(); _statusBarItem = null; }
}

module.exports = { activate, deactivate };
