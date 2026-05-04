
import fs from 'fs';

const content = fs.readFileSync('/Users/venkat/rental-platform/frontend/lib/i18n.ts', 'utf8');
const lines = content.split('\n');
let depth = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let opens = (line.match(/{/g) || []).length;
    let closes = (line.match(/}/g) || []).length;
    depth += opens;
    depth -= closes;
    if (i > 3 && i < 1507 && depth <= 1) {
        console.log(`Depth hit 1 early at line ${i + 1}: ${depth} | ${line}`);
        // Show context
        for (let j = i - 5; j <= i + 5; j++) {
            console.log(`${j + 1}: ${lines[j]}`);
        }
        process.exit(1);
    }
}
