
import fs from 'fs';

const content = fs.readFileSync('/Users/venkat/rental-platform/frontend/lib/i18n.ts', 'utf8');

function getBlock(lang) {
    const startIdx = content.indexOf(`${lang}: {`);
    let depth = 0;
    let endIdx = -1;
    for (let i = startIdx + `${lang}: {`.length - 1; i < content.length; i++) {
        if (content[i] === '{') depth++;
        if (content[i] === '}') depth--;
        if (depth === 0) {
            endIdx = i;
            break;
        }
    }
    return content.substring(startIdx, endIdx + 1);
}

const enBlock = getBlock('en');
const frBlock = getBlock('fr');

function countBraces(block) {
    const opens = (block.match(/{/g) || []).length;
    const closes = (block.match(/}/g) || []).length;
    return { opens, closes };
}

console.log('EN:', countBraces(enBlock));
console.log('FR:', countBraces(frBlock));

function getTopLevelProperties(block) {
    const lines = block.split('\n');
    const props = [];
    for (let line of lines) {
        const match = line.match(/^\s{8}"?(\w+)"?:\s*{/);
        if (match) props.push(match[1]);
    }
    return props;
}

const enProps = getTopLevelProperties(enBlock);
const frProps = getTopLevelProperties(frBlock);

console.log('EN Props:', enProps.length);
console.log('FR Props:', frProps.length);

if (enProps.length !== frProps.length) {
    console.log('Property mismatch!');
    console.log('EN:', enProps);
    console.log('FR:', frProps);
}
