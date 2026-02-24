import ast
import os
import sys

stdlib = sys.stdlib_module_names
external_imports = set()

for root, _, files in os.walk('app'):
    for f in files:
        if f.endswith('.py'):
            with open(os.path.join(root, f), 'r') as file:
                try:
                    tree = ast.parse(file.read())
                    for node in ast.walk(tree):
                        if isinstance(node, ast.Import):
                            for name in node.names:
                                external_imports.add(name.name.split('.')[0])
                        elif isinstance(node, ast.ImportFrom):
                            if node.module:
                                external_imports.add(node.module.split('.')[0])
                except err:
                    pass

required = external_imports - stdlib - {'app'}
print("Required top-level modules:")
for r in sorted(required):
    print(r)
