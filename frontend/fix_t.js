const fs = require('fs');

const errorsTxt = fs.readFileSync('errors.txt', 'utf8');
const lines = errorsTxt.split('\n');

const fileErrors = {};

for (const line of lines) {
    // app/auth/login/page.tsx(61,26): error TS2554: Expected 3 arguments, but got 1.
    const match = line.match(/(.+?)\((\d+),(\d+)\): error TS2554: Expected 3 arguments, but got (\d+)/);
    if (match) {
        const filename = match[1];
        const lineNum = parseInt(match[2], 10);
        const colNum = parseInt(match[3], 10);
        const argsGot = parseInt(match[4], 10);
        
        if (!fileErrors[filename]) fileErrors[filename] = [];
        fileErrors[filename].push({ lineNum, colNum, argsGot });
    }
}

for (const filename of Object.keys(fileErrors)) {
    const errors = fileErrors[filename];
    const content = fs.readFileSync(filename, 'utf8').split('\n');
    
    // Sort descending by line, then by col
    errors.sort((a, b) => {
        if (a.lineNum !== b.lineNum) return b.lineNum - a.lineNum;
        return b.colNum - a.colNum;
    });
    
    for (const { lineNum, colNum, argsGot } of errors) {
        const lineIdx = lineNum - 1;
        let line = content[lineIdx];
        
        const startIdx = colNum - 1;
        const openParenIdx = line.indexOf('(', startIdx);
        
        if (openParenIdx === -1) {
            console.log(`Could not find '(' in ${filename}:${lineNum}`);
            continue;
        }
        
        let parenCount = 1;
        let i = openParenIdx + 1;
        let inString = false;
        let stringChar = '';
        let escape = false;
        
        while (i < line.length && parenCount > 0) {
            const char = line[i];
            
            if (inString) {
                if (escape) {
                    escape = false;
                } else if (char === '\\') {
                    escape = true;
                } else if (char === stringChar) {
                    inString = false;
                }
            } else {
                if (char === "'" || char === '"' || char === '`') {
                    inString = true;
                    stringChar = char;
                } else if (char === '(') {
                    parenCount++;
                } else if (char === ')') {
                    parenCount--;
                }
            }
            
            if (parenCount === 0) break;
            i++;
        }
        
        if (parenCount === 0) {
            if (argsGot === 1) {
                line = line.substring(0, i) + ', undefined, undefined' + line.substring(i);
            } else if (argsGot === 2) {
                line = line.substring(0, i) + ', undefined' + line.substring(i);
            }
            content[lineIdx] = line;
        } else {
            console.log(`Could not find matching ')' in ${filename}:${lineNum}`);
        }
    }
    
    fs.writeFileSync(filename, content.join('\n'), 'utf8');
}

console.log('Done fixing t() calls.');
