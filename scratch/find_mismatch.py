import os

file_path = os.path.join(os.path.dirname(__file__), '..', 'components', 'IpdDashboard.tsx')
with open(file_path, 'r', encoding='utf-8') as f:
    code = f.read()

stack = []
i = 0
n = len(code)
line = 1
col = 1

while i < n:
    char = code[i]
    
    # Handle line/col counting
    if char == '\n':
        line += 1
        col = 1
        i += 1
        continue
    
    # Skip single-line comments
    if char == '/' and i + 1 < n and code[i+1] == '/':
        while i < n and code[i] != '\n':
            i += 1
        continue
        
    # Skip multi-line comments
    if char == '/' and i + 1 < n and code[i+1] == '*':
        i += 2
        while i + 1 < n and not (code[i] == '*' and code[i+1] == '/'):
            if code[i] == '\n':
                line += 1
                col = 1
            i += 1
        i += 2
        continue
        
    # Skip single/double quote strings
    if char in ["'", '"']:
        quote = char
        i += 1
        col += 1
        while i < n and code[i] != quote:
            if code[i] == '\\' and i + 1 < n:
                i += 2
                col += 2
            else:
                if code[i] == '\n':
                    line += 1
                    col = 1
                i += 1
                col += 1
        i += 1
        col += 1
        continue
        
    # Handle backtick strings (template literals)
    if char == '`':
        i += 1
        col += 1
        while i < n and code[i] != '`':
            # Handle interpolation inside backticks: ${...}
            if code[i] == '$' and i + 1 < n and code[i+1] == '{':
                stack.append(('$', line, col))
                i += 2
                col += 2
                # We are now inside JS expression inside backtick string
                # We need to parse JS code until we find matching '}'
                # But we can just parse recursively by pushing onto the stack
                continue
            if code[i] == '\\' and i + 1 < n:
                i += 2
                col += 2
            else:
                if code[i] == '\n':
                    line += 1
                    col = 1
                i += 1
                col += 1
        i += 1
        col += 1
        continue

    # Brackets and Parentheses
    if char in ['{', '(']:
        stack.append((char, line, col))
    elif char == '}':
        if not stack:
            print(f"Extra '}}' found at line {line}:{col}")
        else:
            top_char, top_line, top_col = stack.pop()
            if top_char == '$':
                # This closes the template literal interpolation
                pass
            elif top_char != '{':
                print(f"Mismatched '}}' at line {line}:{col} for '{top_char}' opened at line {top_line}:{top_col}")
    elif char == ')':
        if not stack:
            print(f"Extra ')' found at line {line}:{col}")
        else:
            top_char, top_line, top_col = stack.pop()
            if top_char != '(':
                print(f"Mismatched ')' at line {line}:{col} for '{top_char}' opened at line {top_line}:{top_col}")
                
    i += 1
    col += 1

print("--- Unclosed Elements ---")
for item in reversed(stack):
    print(f"Unclosed '{item[0]}' opened at line {item[1]}:{item[2]}")
