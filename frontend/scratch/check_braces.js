
import fs from 'fs';

const content = fs.readFileSync('/Users/venkat/rental-platform/frontend/lib/i18n.ts', 'utf8');
const lines = content.split('\n');
let depth = 0;

for (let i = 0; i < 2853; i++) {
    const line = lines[i];
    const opens = (line.match(/{/g) || []).length;
    const closes = (line.match(/}/g) || []).length;
    depth += opens;
    depth -= closes;
}
console.log(`Depth at start of line 2854 (index 2853): ${depth}`);
