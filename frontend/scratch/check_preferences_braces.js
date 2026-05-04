
import fs from 'fs';

const content = fs.readFileSync('/Users/venkat/rental-platform/frontend/app/settings/preferences/page.tsx', 'utf8');
const lines = content.split('\n');
let depth = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const opens = (line.match(/{/g) || []).length;
    const closes = (line.match(/}/g) || []).length;
    depth += opens;
    depth -= closes;
    if (depth < 0) {
        console.log(`Extra closing brace at line ${i + 1}: depth ${depth} | ${line}`);
        process.exit(1);
    }
}
console.log(`Final depth: ${depth}`);
