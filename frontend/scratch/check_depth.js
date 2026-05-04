
import fs from 'fs';

const content = fs.readFileSync('/Users/venkat/rental-platform/frontend/lib/i18n.ts', 'utf8');
const lines = content.split('\n');
let depth = 0;
for (let i = 0; i < 2989; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    for (let char of line) {
        if (char === '{') depth++;
        if (char === '}') depth--;
    }
}
console.log(`Depth at start of line 2990: ${depth}`);
