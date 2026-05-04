
import fs from 'fs';

const content = fs.readFileSync('/Users/venkat/rental-platform/frontend/lib/i18n.ts', 'utf8');
let depth = 0;
for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') depth--;
    if (depth < 0) {
        console.log(`Unbalanced brace at position ${i} (char: ${content[i]})`);
        // Show context
        console.log(content.substring(i - 20, i + 20));
        process.exit(1);
    }
}
console.log(`Final depth: ${depth}`);
