# Budget — appli de saisie en temps réel

Appli perso de suivi budgétaire mensuel : dépenses/revenus fixes provisionnés
automatiquement + saisie en temps réel des mouvements (prévus ou non), avec
calcul du restant du mois.

## 1. Base de données (Supabase)

1. Crée un nouveau projet sur [supabase.com](https://supabase.com) (ou utilise un projet existant).
2. Dans l'éditeur SQL du projet, colle et exécute le contenu de `supabase.sql`.
3. Dans **Project Settings → API**, récupère :
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public key` → `VITE_SUPABASE_ANON_KEY`

## 2. Configuration locale

```bash
cp .env.example .env
# puis remplis .env avec tes valeurs Supabase
npm install
npm run dev
```

L'appli tourne alors sur `http://localhost:5173`.

## 3. Déploiement (Vercel)

1. Pousse ce repo sur GitHub (voir plus bas).
2. Sur [vercel.com](https://vercel.com), "Add New Project" → importe le repo.
3. Dans les réglages du projet Vercel, ajoute les variables d'environnement :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Déploie. Chaque `git push` sur la branche principale redéploiera automatiquement.

Sur ton téléphone, ouvre l'URL Vercel dans le navigateur puis
"Ajouter à l'écran d'accueil" pour un accès en un tap, comme une appli.

## 4. Pousser sur GitHub

```bash
git init
git add .
git commit -m "Première version de l'appli budget"
git branch -M main
git remote add origin https://github.com/<ton-compte>/<ton-repo>.git
git push -u origin main
```

## Prochaine itération

Le champ `tag` est déjà prévu dans la table `transactions` (vide pour l'instant)
pour brancher une catégorisation des dépenses sans migration supplémentaire.
