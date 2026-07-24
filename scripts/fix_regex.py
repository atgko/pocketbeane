path = 'C:/Users/athav/OneDrive/Documents/PocketBeane-git/scripts/scrape_mlb.py'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'id=\\"players_standard_(batting|pitching)\\"' in line:
        lines[i] = line.replace('id=\\"players_standard_(batting|pitching)\\"', 'id=\\\"players_standard_(batting|pitching)\\\"')
        print('Fixed line', i+1, 'table id regex')
    if 'data-stat=\\"([^\\"]+)\\"' in line:
        lines[i] = line.replace('data-stat=\\"([^\\"]+)\\"', 'data-stat=\\\"([^\\"]+)\\\"')
        print('Fixed line', i+1, 'header regex')
with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('done')
