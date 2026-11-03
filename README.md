# 🏠 Gestion de locations d'appartements

Application web de gestion locative pour deux profils :

| Rôle | Ce qu'il peut faire |
|------|---------------------|
| **Administrateur** | Ajouter / modifier les appartements, gérer les utilisateurs, consulter la **caisse**, les recettes, les dépenses, les impayés, les paramètres |
| **Concierge** | Créer des clients, des **réservations**, des **locations**, saisir les **paiements (multiples / partiels)**, enregistrer **ses dépenses**, enregistrer la **sortie** des locataires, imprimer des reçus |

Interface **bilingue français / arabe** (avec affichage droite-à-gauche), **thème clair ou sombre** (bouton soleil/lune, préférence mémorisée), responsive (ordinateur, tablette, téléphone), données partagées en ligne via **Supabase**.

**Application en ligne :** https://aquediyo.github.io/location-appartements/

---

## 1. Base de données (déjà configurée)

Le projet Supabase **aquediyo's Project** (région `eu-west-1`, réf. `rbvmeixxtwhatlazphed`) est déjà prêt :

- schéma complet exécuté (tables, index, triggers, RLS) ;
- confirmation d'e-mail désactivée (`mailer_autoconfirm`) ;
- `js/config.js` contient l'URL et la clé `anon` du projet.

Il n'y a donc **rien à faire** côté Supabase. Le premier compte créé dans l'application devient administrateur.

Pour recréer la base sur un autre projet : **SQL Editor → New query**, collez tout `supabase/schema.sql`, exécutez, puis mettez à jour `js/config.js` (Project Settings → API).

## 2. Lancer l'application en local

Double-cliquez sur **`Lancer l'application.cmd`** : un petit serveur local démarre sur `http://localhost:8090` et le navigateur s'ouvre. Laissez la fenêtre noire ouverte pendant l'utilisation.

> Une connexion Internet est nécessaire (les données sont dans Supabase). Il est aussi possible d'ouvrir directement `index.html`, mais le lanceur évite les restrictions des navigateurs sur les fichiers locaux.

## 3. Mise en ligne (déjà effectuée)

L'application est publiée sur **GitHub Pages** :

**https://aquediyo.github.io/location-appartements/**

Elle est accessible depuis n'importe quel appareil, sans que l'ordinateur reste allumé. Pour mettre à jour le site après une modification, il suffit d'envoyer les fichiers modifiés dans le dépôt GitHub `aquediyo/location-appartements` (branche `main`).

Autres hébergeurs possibles : **Netlify Drop**, **Vercel**, **Cloudflare Pages** (glisser-déposer le dossier).

⚠️ Supabase Storage / Edge Functions ne peuvent **pas** servir cette application : leur domaine partagé force `text/plain` + CSP, le navigateur affiche le code source au lieu de la page.

## 4. Créer les comptes

1. Sur l'écran de connexion, cliquez sur **« Créer un compte »**.
   - **Le tout premier compte créé devient automatiquement administrateur.**
2. Une fois connecté en administrateur : menu **Utilisateurs → Créer un utilisateur**.
   - Renseignez le nom, l'email, un mot de passe (6 caractères minimum) et le rôle **Concierge**.
   - Le compte est **activé automatiquement** et le concierge peut se connecter.
3. Les inscriptions libres restent **inactives** tant qu'un administrateur ne les active pas (menu Utilisateurs → ✅). Un compte inactif ne voit aucune donnée.

## 5. Mettre l'application en ligne

Le site est 100 % statique : envoyez le dossier complet sur un hébergeur gratuit.

- **Netlify Drop** : https://app.netlify.com/drop → glissez-déposez le dossier. Vous obtenez une URL `https://…netlify.app`.
- **Vercel** : `vercel` ou import du dossier.
- **GitHub Pages** : poussez le dossier dans un dépôt, activez Pages.
- **Cloudflare Pages** : upload direct.

⚠️ Ne modifiez pas `index.html` pour changer la langue par défaut : utilisez `defaultLang` dans `js/config.js` (chaque utilisateur peut ensuite basculer FR/AR dans la barre du haut).

---

## Utilisation quotidienne

### Appartements (admin)
- **Appartements → Ajouter** : nom, adresse, ville, pièces, **loyer mensuel**, **prix par nuitée** (optionnel), statut, description.
- Le statut **Occupé / Disponible** est mis à jour automatiquement quand une location commence ou se termine.
- Un appartement lié à une location ou une réservation ne peut pas être supprimé (protection de l'historique).

### Réservations
- **Réservations → Nouvelle réservation** : type de séjour (**mensuel** ou **à la nuitée**), appartement, client, dates, acompte, montant.
- En mode **à la nuitée**, le nombre de nuits et le montant sont calculés automatiquement à partir des dates et du prix par nuitée de l'appartement.
- Boutons : ✅ confirmer, ✖ annuler, 🔑 **convertir en location**.
- À la conversion, le type de séjour, les dates et l'acompte sont conservés (l'acompte devient le **premier paiement** dans la caisse).

### Locations
- **Locations → Nouvelle location** : type de location (**mensuelle** ou **à la nuitée**), appartement, client, dates, durée, prix, total.
- En mode **à la nuitée** : le nombre de nuits est calculé automatiquement (`date de fin − date de début`, minimum 1 nuit) et le total = **nuits × prix par nuitée**.
- En mode **mensuel** : durée en mois et total = **mois × loyer mensuel**.
- Un appartement ne peut avoir **qu'une seule location active** à la fois (contrôle en base).
- Cliquez sur **Détails** pour :
  - voir le type de location, le total, le payé, le reste, la progression ;
  - ajouter des **paiements partiels** ;
  - **imprimer un reçu** (le type de séjour et la durée y figurent) ;
  - modifier la location ou un paiement ;
  - **enregistrer la sortie** du locataire (l'appartement redevient disponible).

### Dépenses (admin + concierge)
- Menu **Dépenses → Nouvelle dépense** : libellé, montant, date, catégorie, notes.
- Chaque dépense est automatiquement enregistrée **au nom de l'utilisateur connecté** (affiché dans la colonne « Payé par »).
- Le **concierge** ne voit et ne gère que **ses propres dépenses** ; l'**administrateur** voit et gère **toutes** les dépenses, avec un filtre par utilisateur.
- Période : aujourd'hui, semaine, mois, année, tout, ou dates personnalisées ; **export CSV**.
- Les dépenses alimentent aussi la **Caisse** (admin) pour le calcul du solde.

### Caisse (admin)
- Période : aujourd'hui, semaine, mois, année, tout, ou dates personnalisées.
- Cartes : **Recettes**, **Dépenses**, **Solde**, **Impayés**.
- Répartition des recettes par **mode de paiement**, **appartement** et **utilisateur**.
- Liste de tous les mouvements (paiements + dépenses), avec **export CSV** (ouvrable dans Excel).

### Paramètres (admin)
- Nom de l'activité (affiché dans l'app et sur les reçus).
- Code devise et symbole (DZD/DA, MAD/DH, TND/DT, EUR/€, USD/$…).

---

## Structure du projet

```
index.html               Interface (connexion + application)
css/styles.css           Styles, responsive, RTL arabe
js/config.js             ← VOS CLÉS SUPABASE
js/i18n.js               Traductions français / arabe
js/core.js               Routeur, helpers, formatage, modales
js/app.js                Authentification et démarrage
js/views/dashboard.js    Tableau de bord
js/views/apartments.js   Appartements
js/views/clients.js      Clients + historique
js/views/reservations.js Réservations + conversion
js/views/rentals.js      Locations, paiements, reçus, sorties
js/views/payments.js     Journal des paiements
js/views/expenses.js     Dépenses (admin + concierge), export CSV
js/views/cash.js         Caisse, synthèse, export CSV
js/views/users.js        Comptes et rôles
js/views/settings.js     Paramètres
supabase/schema.sql      Base de données + sécurité
```

---

## Sécurité et bonnes pratiques

- **Row Level Security (RLS)** activée sur toutes les tables : un utilisateur non connecté ou inactif ne peut rien lire.
- Seul un **administrateur actif** peut gérer les appartements, les utilisateurs, les paramètres et la caisse.
- Un utilisateur ne peut pas modifier son propre rôle ni se désactiver, et il doit toujours rester **au moins un administrateur actif**.
- L'**anon key** est publique par nature : elle est protégée par les politiques RLS. Ne partagez **jamais** la clé `service_role`.
- Sauvegarde : Supabase → **Database → Backups** (selon l'offre), ou export CSV de la caisse régulièrement.

## Dépannage

| Problème | Solution |
|---------|----------|
| « Configuration requise » | Les clés de `js/config.js` ne sont pas remplies ou sont incorrectes. |
| « Email ou mot de passe incorrect » | Vérifiez le compte ; recréez un utilisateur depuis l'admin si besoin. |
| « Votre email n'est pas encore confirmé » | Désactivez « Confirm email » dans Supabase (Authentication → Email) ou confirmez l'email manuellement. |
| Un nouveau compte ne voit rien | Il est inactif : activez-le dans **Utilisateurs**. |
| « Cet appartement a déjà une location en cours » | Terminez d'abord la location active (bouton **Sortie**). |
| Aucune donnée après connexion | Vérifiez que `supabase/schema.sql` a bien été exécuté en entier. |

---

© Application de gestion locative — personnalisable selon votre activité.
