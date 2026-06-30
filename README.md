# MemeScreen 🚀 - Live Chat / Screen Takeover

Un projet complet permettant d'envoyer une photo ou vidéo depuis une application mobile, qui sera uploadée sur Discord (CDN gratuit) et diffusée instantanément en plein écran sur tous les autres téléphones connectés au serveur avec un système de file d'attente (Queue) !

## Structure du Projet
- `backend/` : Serveur Node.js (Socket.io + Discord.js + Express)
- `frontend/` : Application mobile React Native (Expo)

---

## 1. Configuration du Bot Discord (Stockage CDN Gratuit)

1. Rends-toi sur le [Discord Developer Portal](https://discord.com/developers/applications).
2. Clique sur **"New Application"**, et donne un nom à ton bot (ex: MemeScreenBot).
3. Va dans l'onglet **"Bot"** à gauche, et clique sur **"Reset Token"**. Copie ce **Token**, c'est le `DISCORD_TOKEN`.
4. Dans la même page, dans **"Privileged Gateway Intents"**, active `Message Content Intent` (recommandé).
5. Va dans l'onglet **"OAuth2" -> "URL Generator"**.
6. Coche la case `bot` dans "Scopes".
7. Dans "Bot Permissions", coche `Send Messages` et `Attach Files`.
8. Copie l'URL générée en bas, ouvre-la dans ton navigateur et invite le bot sur ton propre serveur Discord.
9. Sur ton serveur Discord, crée un salon textuel privé (ex: `#uploads-memescreen`).
10. Va dans les paramètres de ton compte Discord -> Avancé -> Active le **"Mode Développeur"**.
11. Fais un clic droit sur le salon `#uploads-memescreen` que tu as créé et clique sur **"Copier l'ID du salon"**. C'est ton `DISCORD_CHANNEL_ID`.

---

## 2. Lancement du Serveur (Back-end)

Ouvre un terminal et place-toi dans le dossier `backend` :

```bash
cd backend
npm install
```

Configure tes variables d'environnement :
1. Copie le fichier `.env.example` en `.env` (ou renomme-le simplement en `.env`).
2. Ouvre le fichier `.env` et remplis-le avec ton Token et ton ID de salon récupérés à l'étape 1.

Lance le serveur :
```bash
npm start
```
*(ou `npm run dev` pour avoir le rechargement automatique)*

Le serveur devrait afficher :
```text
Serveur Node.js démarré sur le port 3000
[Discord] Bot connecté en tant que MemeScreenBot#1234
```

---

## 3. Lancement de l'Application (Front-end)

Ouvre un nouveau terminal et place-toi dans le dossier `frontend` :

```bash
cd frontend
npm install
```

**⚠️ ÉTAPE CRITIQUE** : 
Dans le fichier `frontend/App.tsx` (ligne 9 environ), tu **dois** modifier la variable `BACKEND_URL` pour y mettre l'adresse IP locale de ton ordinateur. 
*Exemple : `const BACKEND_URL = 'http://192.168.1.15:3000';`*
*(Sur Windows, tape `ipconfig` dans un terminal et cherche l'adresse IPv4 de ta carte Wi-Fi)*.

Lance l'application :
```bash
npm start
```
- Scanne le QR Code affiché avec l'application **Expo Go** sur ton téléphone (connecté au même réseau Wi-Fi que ton PC).
- L'interface s'affichera, autorise l'accès à tes photos.
- Teste ! Envoie une photo ou une vidéo. Le fichier sera transféré sur Discord, puis s'affichera immédiatement en plein écran ! S'il y a plusieurs envois, ils seront mis en file d'attente.
