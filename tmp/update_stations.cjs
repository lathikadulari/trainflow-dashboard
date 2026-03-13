const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/data/mockData.ts');
let content = fs.readFileSync(filePath, 'utf8');

const kvStations = [
    "Colombo Fort", "Maradana", "Baseline Road", "Cotta Road", "Narahenpita",
    "Kirulapana", "Nugegoda", "Pengiriwatta", "Udahamulla", "Navinna",
    "Maharagama", "Pannipitiya", "Kottawa", "Makumbura (Multimodal Center)", "Malapalle",
    "Homagama Hospital", "Homagama", "Panagoda", "Godagama", "Meegoda",
    "Watareka", "Liyanwala", "Padukka", "Arukwatta", "Angampitiya",
    "Uggalla", "Pinnawala", "Gammana", "Morakele", "Waga",
    "Kadugoda", "Arapanagama", "Kosgama", "Aluthambalama", "Miriswatta",
    "Hingurala", "Puwakpitiya", "Puwakpitiya Town", "Kiriwadala", "Avissawella"
];

let newStationsText = '';
let currentId = 400;

kvStations.forEach((station, index) => {
    let code = station.substring(0, 3).toUpperCase();
    if (station === 'Makumbura (Multimodal Center)') code = 'MAK';
    if (station === 'Colombo Fort') code = 'FOT';

    let name = station === 'Makumbura (Multimodal Center)' ? 'Makumbura' : station;

    newStationsText += `  {
    id: '${currentId + index}',
    name: '${name}',
    code: '${code}',
    province: 'Western',
    line: 'Kelani Valley Line',
    sensors: [
      { id: 's${currentId + index}-1', name: 'Sensor A', status: 'online', lastPing: new Date() },
      { id: 's${currentId + index}-2', name: 'Sensor B', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: ${Math.floor(Math.random() * 100)}
  }`;
    if (index < kvStations.length - 1) {
        newStationsText += ',\n';
    } else {
        newStationsText += '\n';
    }
});

const startStr = 'export const mockStations: Station[] = [';
const endStr = '];\n\nexport const mockTrainApproaches';
const endStrWin = '];\r\n\r\nexport const mockTrainApproaches';

let arrayStartIdx = content.indexOf(startStr);
let arrayEndIdx = content.indexOf(endStr);
if (arrayEndIdx === -1) {
    arrayEndIdx = content.indexOf(endStrWin);
}

if (arrayStartIdx === -1 || arrayEndIdx === -1) {
    console.error("Could not find mockStations array boundaries");
    process.exit(1);
}

const prefix = content.substring(0, arrayStartIdx + startStr.length);
const suffix = content.substring(arrayEndIdx);
// Add the implicit \n or \r\n
let innerContent = content.substring(arrayStartIdx + startStr.length, arrayEndIdx);
// Strip leading/trailing newlines to be safe
innerContent = innerContent.replace(/^\s+|\s+$/g, '');

// Split by '  },\n  {' or similar isn't safe. Use eval? No, we have 'new Date()'.
// Let's just use bracket counting.

let blocks = [];
let currentBlock = '';
let bracketCount = 0;

for (let i = 0; i < innerContent.length; i++) {
    const char = innerContent[i];
    if (char === '{') bracketCount++;
    if (char === '}') bracketCount--;

    currentBlock += char;

    if (bracketCount === 0 && currentBlock.includes('id:') && currentBlock.includes('name:')) {
        let cleanedBlock = currentBlock.trim();
        // remove trailing comma if present
        if (cleanedBlock.endsWith(',')) cleanedBlock = cleanedBlock.substring(0, cleanedBlock.length - 1).trim();
        blocks.push(cleanedBlock);
        currentBlock = '';
    }
}

// Any remaining text that might be a block
if (currentBlock.includes('id:') && currentBlock.includes('name:')) {
    let cb = currentBlock.trim();
    if (cb.endsWith(',')) cb = cb.substring(0, cb.length - 1).trim();
    blocks.push(cb);
}

// Filter out old KV line blocks
let keptBlocks = blocks.filter(b => {
    return !(b.includes("line: 'KV Line'") || b.includes("line: 'Kelani Valley Line'"));
});

// Add our newly generated KV lines as one giant block
keptBlocks.push(newStationsText.trim());

const newArrayContent = keptBlocks.join(',\n');

// Reconstruct file
const newContent = prefix + '\n' + newArrayContent + '\n' + suffix;

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully updated KV Line stations.');
