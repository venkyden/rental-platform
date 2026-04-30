import re
from collections import defaultdict

with open('errors.txt', 'r') as f:
    lines = f.readlines()

file_errors = defaultdict(list)
for line in lines:
    match = re.match(r'(.+?)\((\d+),(\d+)\): error TS2554: Expected 3 arguments, but got (\d+)', line)
    if match:
        filename = match.group(1)
        line_num = int(match.group(2))
        col_num = int(match.group(3))
        args_got = int(match.group(4))
        file_errors[filename].append((line_num, col_num, args_got))

for filename, errors in file_errors.items():
    with open(filename, 'r') as f:
        content = f.read().split('\n')
    
    # Sort errors by line descending, then col descending so we can modify in place
    errors.sort(key=lambda x: (-x[0], -x[1]))
    
    for line_num, col_num, args_got in errors:
        line_idx = line_num - 1
        line = content[line_idx]
        
        # col_num is 1-indexed, so the 't' is at line[col_num - 1]
        start_idx = col_num - 1
        
        # Sometimes TS points to the function name, sometimes to the argument. 
        # Let's find the first '(' after start_idx
        open_paren_idx = line.find('(', start_idx)
        if open_paren_idx == -1:
            print(f"Could not find '(' in {filename}:{line_num}")
            continue
            
        paren_count = 1
        i = open_paren_idx + 1
        in_string = False
        string_char = ''
        escape = False
        
        while i < len(line) and paren_count > 0:
            char = line[i]
            
            if in_string:
                if escape:
                    escape = False
                elif char == '\\':
                    escape = True
                elif char == string_char:
                    in_string = False
            else:
                if char in ("'", '"', '`'):
                    in_string = True
                    string_char = char
                elif char == '(':
                    paren_count += 1
                elif char == ')':
                    paren_count -= 1
                    
            if paren_count == 0:
                break
            i += 1
            
        if paren_count == 0:
            # i is the index of the closing parenthesis
            if args_got == 1:
                content[line_idx] = line[:i] + ', undefined, undefined' + line[i:]
            elif args_got == 2:
                content[line_idx] = line[:i] + ', undefined' + line[i:]
        else:
            print(f"Could not find matching ')' in {filename}:{line_num}")
            
    with open(filename, 'w') as f:
        f.write('\n'.join(content))
        
print("Done fixing t() calls.")
