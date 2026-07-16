import os

replacements = {
    'Ã¡': 'á',
    'Ã©': 'é',
    'Ã­': 'í',
    'Ã³': 'ó',
    'Ãº': 'ú',
    'Ã±': 'ñ',
    'Ã ': 'Á',
    'Ã‰': 'É',
    'Ã': 'Í',
    'Ã“': 'Ó',
    'Ãš': 'Ú',
    'Ã‘': 'Ñ',
    'â€”': '—',
    'â”€': '─',
    'â–¾': '▾',
}

def fix_file(path):
    try:
        with open(path, 'rb') as f:
            content = f.read()
        
        # We need to decode as ISO-8859-1 (Latin-1) to see the mangled sequences as strings
        text = content.decode('latin-1')
        
        # But wait, if the file is UTF-8 but contains double-encoded chars, 
        # it's better to just treat it as UTF-8 and replace the literal byte sequences.
        # However, the replacements dict above is already in "mangled string" format.
        
        # Let's try to decode as UTF-8 first.
        try:
            text = content.decode('utf-8')
            for mangled, correct in replacements.items():
                text = text.replace(mangled, correct)
            
            with open(path, 'w', encoding='utf-8') as f:
                f.write(text)
            print(f"Fixed: {path}")
        except UnicodeDecodeError:
            print(f"Skipping (not UTF-8): {path}")
            
    except Exception as e:
        print(f"Error fixing {path}: {e}")

root_dir = r'c:\crm\frontend\src'
for root, dirs, files in os.walk(root_dir):
    for file in files:
        if file.endswith('.jsx'):
            fix_file(os.path.join(root, file))
