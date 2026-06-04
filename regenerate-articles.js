// Régénère articles.json et articles/list.json depuis les fichiers .md
// Même logique que server.js::regenerateArticlesJson()
const fs = require('fs');
const path = require('path');

async function run() {
    const files = await fs.promises.readdir('articles');
    const mdFiles = files.filter(f => f.endsWith('.md'));
    const articles = [];

    for (const file of mdFiles) {
        try {
            const text = await fs.promises.readFile(path.join('articles', file), 'utf-8');
            const parts = text.split('---');
            if (parts.length < 3) continue;
            const fm = parts[1];
            const content = parts.slice(2).join('---').trim();
            const get = (k) => {
                const m = fm.match(new RegExp(k + ':\\s*(.*)'));
                return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
            };
            const tagsMatch = fm.match(/tags:\s*\[(.*)\]/);
            const tags = tagsMatch
                ? tagsMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, ''))
                : [];
            const titre = get('titre');
            if (!titre) continue;
            articles.push({
                id: file.replace('.md', ''),
                titre,
                date: get('date'),
                heure: get('heure'),
                categorie: get('categorie'),
                image: get('image'),
                video: get('video'),
                pdf: get('pdf'),
                extrait: get('extrait'),
                rawContent: content,
                tags,
                type: get('type')
            });
        } catch (e) {
            process.stderr.write(`Skipping ${file}: ${e.message}\n`);
        }
    }

    articles.sort((a, b) =>
        new Date(`${b.date}T${b.heure || '00:00'}`) - new Date(`${a.date}T${a.heure || '00:00'}`)
    );

    await fs.promises.writeFile('articles.json', JSON.stringify(articles));

    const sorted = mdFiles.sort((a, b) => parseInt(b) - parseInt(a));
    await fs.promises.writeFile('articles/list.json', JSON.stringify(sorted, null, 2));

    const une = articles[0];
    process.stdout.write(
        `OK ${articles.length} articles | Une: ${une ? une.titre.slice(0, 55) : '?'}\n`
    );
}

run().catch(e => { process.stderr.write(e.message + '\n'); process.exit(1); });
