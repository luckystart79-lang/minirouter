const fs = require('fs');
const p = 'C:\\Users\\vvthu\\AppData\\Local\\Programs\\Antigravity\\resources\\app\\out\\vs\\code\\electron-browser\\workbench\\workbench.html';
const html = fs.readFileSync(p, 'utf8');
// Find the meta CSP tag content
const match = html.match(/content-security-policy[\s\S]*?content="([\s\S]*?)"/i);
if (match) {
    console.log('CSP FOUND:');
    console.log(match[1]);
} else {
    console.log('CSP NOT FOUND');
}
