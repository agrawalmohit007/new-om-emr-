const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'components', 'IpdDashboard.tsx');
const code = fs.readFileSync(filePath, 'utf8');

const stack = [];
const errors = [];
let i = 0;
const n = code.length;
let line = 1;
let col = 1;

while (i < n) {
  const char = code[i];
  
  if (char === '\n') {
    line++;
    col = 1;
    i++;
    continue;
  }
  
  // Skip single-line comments
  if (char === '/' && i + 1 < n && code[i+1] === '/') {
    while (i < n && code[i] !== '\n') {
      i++;
    }
    continue;
  }
  
  // Skip multi-line comments
  if (char === '/' && i + 1 < n && code[i+1] === '*') {
    i += 2;
    while (i + 1 < n && !(code[i] === '*' && code[i+1] === '/')) {
      if (code[i] === '\n') {
        line++;
        col = 1;
      }
      i++;
    }
    i += 2;
    continue;
  }
  
  // Skip strings
  if (char === "'" || char === '"') {
    const quote = char;
    i++;
    col++;
    while (i < n && code[i] !== quote) {
      if (code[i] === '\\' && i + 1 < n) {
        i += 2;
        col += 2;
      } else {
        if (code[i] === '\n') {
          line++;
          col = 1;
        }
        i++;
        col++;
      }
    }
    i++;
    col++;
    continue;
  }
  
  // Handle backticks (template literals)
  if (char === '`') {
    i++;
    col++;
    while (i < n && code[i] !== '`') {
      if (code[i] === '$' && i + 1 < n && code[i+1] === '{') {
        stack.push({ char: '$', line, col });
        i += 2;
        col += 2;
        continue;
      }
      if (code[i] === '\\' && i + 1 < n) {
        i += 2;
        col += 2;
      } else {
        if (code[i] === '\n') {
          line++;
          col = 1;
        }
        i++;
        col++;
      }
    }
    i++;
    col++;
    continue;
  }
  
  // Brackets and Parentheses
  if (char === '{' || char === '(') {
    stack.push({ char, line, col });
  } else if (char === '}') {
    if (stack.length === 0) {
      errors.push(`Extra '}' at line ${line}:${col}`);
    } else {
      const top = stack.pop();
      if (top.char === '$') {
        // Closed template expression
      } else if (top.char !== '{') {
        errors.push(`Mismatched '}' at line ${line}:${col} for '${top.char}' opened at line ${top.line}:${top.col}`);
      }
    }
  } else if (char === ')') {
    if (stack.length === 0) {
      errors.push(`Extra ')' at line ${line}:${col}`);
    } else {
      const top = stack.pop();
      if (top.char !== '(') {
        errors.push(`Mismatched ')' at line ${line}:${col} for '${top.char}' opened at line ${top.line}:${top.col}`);
      }
    }
  }
  
  i++;
  col++;
}

console.log('--- Unclosed Elements ---');
for (let j = stack.length - 1; j >= 0; j--) {
  console.log(`Unclosed '${stack[j].char}' opened at line ${stack[j].line}:${stack[j].col}`);
}

console.log('--- Extra/Mismatched Elements ---');
errors.forEach(e => console.log(e));
