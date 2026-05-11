// Write bridge script to its own file + add <script src> to workbench.html
const fs = require('fs');
const path = require('path');

const wbDir = 'C:\\Users\\vvthu\\AppData\\Local\\Programs\\Antigravity\\resources\\app\\out\\vs\\code\\electron-browser\\workbench';
const wbPath = path.join(wbDir, 'workbench.html');
const bridgeFile = path.join(wbDir, '9router-bridge.js');

// 1. Write bridge script to its own file
const bridgeScript = `
(function(){
    if(window._9routerBridgeLoaded) return;
    window._9routerBridgeLoaded = true;
    var PORT = 3848;

    function scanDOM(){
        var r = {textareas:[], editables:[], buttons:[], title: document.title || ''};
        document.querySelectorAll('textarea').forEach(function(el,i){
            r.textareas.push({i:i, cls:(el.className||'').substring(0,100), vis:el.offsetParent!==null});
        });
        document.querySelectorAll('[contenteditable="true"]').forEach(function(el,i){
            r.editables.push({i:i, tag:el.tagName, cls:(el.className||'').substring(0,100), role:el.getAttribute('role')||'', vis:el.offsetParent!==null});
        });
        document.querySelectorAll('button[aria-label]').forEach(function(el,i){
            if(i<15) r.buttons.push({label:el.getAttribute('aria-label'), vis:el.offsetParent!==null});
        });
        return r;
    }

    function findInput(){
        var eds = document.querySelectorAll('[contenteditable="true"][role="textbox"]');
        for(var i=0;i<eds.length;i++){
            if(eds[i].offsetParent!==null) return {el:eds[i],type:'ce'};
        }
        return null;
    }

    function findSend(){
        var btns = document.querySelectorAll('button[aria-label]');
        for(var i=0;i<btns.length;i++){
            var label = btns[i].getAttribute('aria-label') || '';
            if(label.toLowerCase().includes('send message') && btns[i].offsetParent!==null) return btns[i];
        }
        return null;
    }

    function report(d){
        d.windowTitle = document.title || '';
        fetch('http://127.0.0.1:'+PORT+'/bridge-report',{
            method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify(d)
        }).catch(function(){});
    }

    function submit(text){
        var f = findInput();
        if(!f){ report({event:'fail',reason:'no-input',dom:scanDOM()}); return; }
        
        var el = f.el;
        el.focus();
        
        // Clear existing content
        el.textContent = '';
        el.dispatchEvent(new Event('input',{bubbles:true}));
        
        // Use execCommand to insert text (works with rich text editors)
        document.execCommand('insertText', false, text);
        
        el.dispatchEvent(new Event('input',{bubbles:true}));
        
        report({event:'text-inserted', textLength: text.length, type:f.type});
        
        setTimeout(function(){
            var btn = findSend();
            if(btn){
                btn.click();
                report({event:'ok',method:'btn-send-message',type:f.type});
            } else {
                el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,bubbles:true,cancelable:true}));
                report({event:'ok',method:'enter',type:f.type});
            }
        },500);
    }

    async function poll(){
        try {
            var res = await fetch('http://127.0.0.1:'+PORT+'/bridge-poll');
            if(res.ok){
                var data = await res.json();
                if(data.prompt) submit(data.prompt);
                if(data.scanDom) report({event:'scan',dom:scanDOM()});
            }
        } catch(e){}
    }

    setTimeout(function(){ report({event:'loaded',dom:scanDOM()}); }, 3000);
    setInterval(poll, 500);
    console.log('[9Router Bridge] Own file loaded, port '+PORT);
})();
`;

fs.writeFileSync(bridgeFile, bridgeScript, 'utf8');
console.log('Written:', bridgeFile);

// 2. Add <script src> tag to workbench.html (if not already there)
let html = fs.readFileSync(wbPath, 'utf8');

// Clean old injection
html = html.replace(/<!-- 9ROUTER-BRIDGE-START -->[\s\S]*?<!-- 9ROUTER-BRIDGE-END -->/g, '');

// Check if AG Auto Click tag exists — insert RIGHT AFTER it
const agEndTag = '<!-- AG-AUTO-CLICK-SCROLL-END -->';
const ts = Date.now();
const injection = `\n<!-- 9ROUTER-BRIDGE-START -->\n<script src="9router-bridge.js?v=${ts}"></script>\n<!-- 9ROUTER-BRIDGE-END -->`;

if (html.includes(agEndTag)) {
    // Place right after AG Auto Click's tag
    html = html.replace(agEndTag, agEndTag + injection);
    console.log('Injected AFTER AG Auto Click tag');
} else {
    // Fallback: before </html>
    html = html.replace(/<\/html>/i, injection + '\n</html>');
    console.log('Injected before </html>');
}

fs.writeFileSync(wbPath, html, 'utf8');
console.log('Done! Reload Antigravity to activate.');
