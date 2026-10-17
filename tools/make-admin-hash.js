#!/usr/bin/env node
// Génère ADMIN_PASSWORD_HASH et SESSION_SECRET pour l'admin en ligne.
// Usage :  node tools/make-admin-hash.js
// Le mot de passe est saisi dans le terminal (masqué) : il n'est jamais écrit
// dans un fichier ni transmis. Copiez ensuite les 2 valeurs affichées dans
// Cloudflare Pages → Settings → Variables and Secrets (type Secret).
const crypto = require('crypto');
const readline = require('readline');

function askHidden(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s); };
    rl.question(q, (a) => { rl.close(); process.stdout.write('\n'); resolve(a); });
  });
}

(async () => {
  const p1 = await askHidden('Mot de passe admin (12 caractères minimum) : ');
  if (p1.length < 12) { console.error('Trop court : 12 caractères minimum.'); process.exit(1); }
  const p2 = await askHidden('Confirmez le mot de passe : ');
  if (p1 !== p2) { console.error('Les deux saisies diffèrent.'); process.exit(1); }
  const iter = 100000;   // maximum accepté par Cloudflare Workers
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(p1, salt, iter, 32, 'sha256');
  console.log('\nADMIN_PASSWORD_HASH=pbkdf2$' + iter + '$' + salt.toString('base64') + '$' + hash.toString('base64'));
  console.log('SESSION_SECRET=' + crypto.randomBytes(48).toString('base64url'));
  console.log('\n(ADMIN_USER = l\'identifiant de votre choix ; GITHUB_TOKEN = jeton fine-grained « Contents : Read and write » sur le dépôt algeria-tech.)');
})();
