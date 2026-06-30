# MemeScreen 🚀

MemeScreen est une application Windows qui te permet de créer et d'envoyer des memes (images ou vidéos) directement sur Discord. Dès qu'un média est envoyé, il s'affiche **instantanément sous forme de pop-up transparent par-dessus l'écran** de toutes les personnes utilisant l'application ! Parfait pour troller tes amis en pleine partie.

---

## 📥 1. Installation

Le plus simple est d'utiliser la version compilée automatiquement par GitHub :

1. Rends-toi dans l'onglet **[Releases](../../releases/latest)** de ce dépôt GitHub.
2. Télécharge le fichier `MemeScreen Setup.exe` de la dernière version.
3. Lance l'installateur. L'application s'ouvrira toute seule !
4. *Note : L'application possède un système de mise à jour automatique. Si une nouvelle version est publiée, elle se mettra à jour en arrière-plan sans aucune action de ta part.*

---

## 🤖 2. Création du Bot Discord

MemeScreen utilise l'infrastructure gratuite de Discord pour stocker et transférer les vidéos très rapidement. Tu as donc besoin d'un Bot.

1. Rends-toi sur le [Discord Developer Portal](https://discord.com/developers/applications).
2. Clique sur **"New Application"**, et donne un nom à ton bot (ex: MemeScreenBot).
3. Va dans l'onglet **"Bot"** à gauche, et clique sur **"Reset Token"**. Copie ce **Token** (Garde-le secret !).
4. Toujours dans l'onglet Bot, descends jusqu'à **"Privileged Gateway Intents"** et active `Message Content Intent`.
5. Va dans l'onglet **"OAuth2" -> "URL Generator"**.
6. Coche la case `bot` dans "Scopes".
7. Dans "Bot Permissions", coche `Send Messages` et `Attach Files`.
8. Copie l'URL générée en bas, ouvre-la dans ton navigateur et invite le bot sur ton propre serveur Discord.
9. Sur ton serveur Discord, crée un salon textuel privé (ex: `#uploads-memescreen`).
10. Va dans les paramètres de ton compte Discord -> Avancé -> Active le **"Mode Développeur"**.
11. Fais un clic droit sur le salon `#uploads-memescreen` que tu as créé et clique sur **"Copier l'ID du salon"**.

---

## 🚀 3. Utilisation de l'Application

1. Lance MemeScreen.
2. Sur la page de **Connexion**, colle le **Token du Bot** et l'**ID du salon** récupérés précédemment. (Ces infos seront sauvegardées pour la prochaine fois).
3. Une fois connecté, clique sur **Choisir un média** pour sélectionner une image ou une vidéo (Max 15 Mo, l'application s'occupe de compresser les vidéos trop lourdes).
4. **Éditeur :** Tu peux ajouter du texte façon "Meme" par-dessus ton image ou ta vidéo ! Déplace-le à la souris et ajuste sa taille.
5. Clique sur **Envoyer 🚀**.
6. L'application va traiter le fichier et l'envoyer sur Discord. Une fois reçu, l'overlay transparent s'activera et affichera ton oeuvre en plein écran !

---

## ⚙️ Raccourci d'Urgence

Si ton ami t'envoie une vidéo de 30 secondes au pire moment de ta partie, tu peux utiliser le **Panic Button** :
Appuie n'importe quand sur **`Ctrl + Shift + X`** (sur Windows) pour faire disparaître instantanément le média en cours de lecture.

---

## 🛠️ Pour les développeurs

Si tu souhaites modifier le code ou lancer l'application en mode développement :

```bash
cd desktop-app
npm install
npm start
```

*Pour publier une nouvelle mise à jour à tes utilisateurs, augmente simplement la `version` dans le fichier `package.json` et fais un Push sur la branche `main` ! GitHub Actions s'occupera de compiler et distribuer la mise à jour.*
