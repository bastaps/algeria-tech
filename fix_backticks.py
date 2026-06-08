with open('E:/algeria-tech/script.js', 'rb') as f:
    content = f.read()

# Fix escaped backticks in the weather catch block (\` -> `)
section = content[73400:73800]
# \x5c = backslash, \x60 = backtick
fixed_section = section.replace(b'\x5c\x60', b'\x60')
print('Replacements:', section.count(b'\x5c\x60'))

new_content = content[:73400] + fixed_section + content[73800:]

with open('E:/algeria-tech/script.js', 'wb') as f:
    f.write(new_content)

# Verify
with open('E:/algeria-tech/script.js', 'rb') as f:
    verify = f.read()
idx = verify.find(b'} catch(e) {\r\n        widget.innerHTML')
print('After fix bytes:', verify[idx:idx+150])
print('OK')
