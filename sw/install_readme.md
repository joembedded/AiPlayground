# AI Playground - Demo-Installation (MiniChat)

File: install_read.me

Eine Sammlung nuetzlicher Routinen rund um OpenAI, Sprache, Sprachassistenten und kleine Tools.

Stand: V0.04 (13.01.2026)

## Inhalt

- [AI Playground - Demo-Installation (MiniChat)](#ai-playground---demo-installation-minichat)
  - [Inhalt](#inhalt)
  - [Ueberblick](#ueberblick)
  - [Architektur](#architektur)
  - [Voraussetzungen](#voraussetzungen)
  - [Quickstart (lokale Demo)](#quickstart-lokale-demo)
  - [Konfiguration: Keys \& USERDIR](#konfiguration-keys--userdir)
  - [Startpunkte (URLs)](#startpunkte-urls)
  - [Admin \& Tools](#admin--tools)
  - [Demo-User \& Personas](#demo-user--personas)
  - [Datenablage](#datenablage)
  - [Troubleshooting](#troubleshooting)
  - [Organisatorisches](#organisatorisches)

## Ueberblick

Dieses Repo enthaelt u.a. eine lauffaehige Web-Demo namens **MiniChat**: ein Chat-UI in HTML/JS mit Audio (STT/TTS) und einer PHP-API-Schicht, die Requests an OpenAI weiterleitet.

Typische Einsatzideen:

- Storyteller (z. B. Kinder-Geschichten, kontrollierbare Inhalte)
- Hands-Free Tasks (Sprachassistent fuer interne Aufgaben)
- Beratungs-Experten (Handbuch-/Datenblatt-Wissen im Intranet/Web)

## Architektur

Browser (JS) -> PHP API -> OpenAI

Hinweis: Es ist ein asynchroner Voice-Chat (keine echte synchrone Realtime-App). Je nach Setup liegt die Latenz typischerweise bei ca. 2-5 Sekunden.

## Voraussetzungen

- Webserver mit PHP (empfohlen PHP 8.x) und aktivem cURL
- Browser mit Mikrofon-Unterstuetzung
  - Audiozugriff funktioniert zuverlaessig unter https:// oder auf http://localhost
- Ein gueltiger OpenAI API Key

## Quickstart (lokale Demo)

1. Projekt in ein Webroot legen (Beispiel):
   - c:\html\wrk\ai\playground
2. Keys-Datei anlegen:
   - sw/secret/_dummy_keys.inc.php -> kopieren nach sw/secret/keys.inc.php
3. In sw/secret/keys.inc.php mindestens setzen:
   - OPENAI_API_KEY
   - USERDIR (fuer die Demo am einfachsten: geheimnix)
4. Optimal XAMP zur Entwicklung
5. Im Browser oeffnen:
   - http://localhost/wrk/ai/playground/sw/minichat.html

## Konfiguration: Keys & USERDIR

Die Datei sw/secret/keys.inc.php ist nicht im Repo enthalten und muss lokal erstellt werden.

Vorlage:

- sw/secret/_dummy_keys.inc.php

Minimaler Inhalt (Beispiel):

```php
<?php
define('OPENAI_API_KEY', 'sk-...');
define('USERDIR', 'geheimnix');
```

Was ist USERDIR?

- In USERDIR liegen User-Daten, Logs und (je nach Feature) Audio-Uploads.
- Im Repo existieren bereits Beispiel-Strukturen wie geheimnix/ und default_geheimnix/.

## Startpunkte (URLs)

- MiniChat UI (loka):
  - http://localhost/wrk/ai/playground/sw/minichat.html

API (fuer Debug/Tests):

- Login: sw/api/login.php?cmd=login&user=...&password=...
- Chat: sw/api/oai_chat.php
- STT/TTS: sw/api/oai_stt.php, sw/api/oai_tts.php

## Admin & Tools

Im Ordner sw/tools/ liegen Hilfsseiten:

- sw/tools/loginmonitor.html - Login/Session testen
- sw/tools/expresschat.html - schnelles Chat-Replay/Debug
- sw/tools/expressvoice.html - Voice-Tests
- sw/tools/admin.html - User/Persona Verwaltung ueber sw/api/admin.php

Hinweis: sw/api/admin.php akzeptiert nur Benutzer mit Rolle admin oder agent (in deren credentials.json.php).

## Demo-User & Personas

Userdaten liegen unter:

- <USERDIR>/users/<username>/credentials.json.php
- <USERDIR>/users/<username>/credits.json.php

Hinweise:

- Usernamen muessen 6-32 Zeichen haben (a-zA-Z0-9_-).
- Passwoerter sind gehasht gespeichert (password_hash(...)).
- Templates liegen typischerweise unter <USERDIR>/users/_template_*.

Vordefinierte Personas (Audio-Samples):

- Jack (Autoverkaeufer): assets/jack.opus
- Jana (Almwirtin): assets/jana.opus
- Vilo (Waldwichtel, kindgerechte Moderation): assets/vilo.opus
- Fabi (neutral, "unfiltriert"): assets/fabi.opus

Passwort-Hinweis:

- In den Demo-Daten ist haeufig ein Standardpasswort vorgesehen (z. B. "geheimnix"). Falls unklar: ueber sw/tools/admin.html ein neues Passwort setzen. Die Passwörter werden in USERDIR nur gehasht gespeichert.

## Datenablage

Je nach Feature werden Daten unter USERDIR gespeichert:

- Logs: <USERDIR>/logs/logfile.log
- Login-Sessions: <USERDIR>/users/<user>/access.json.php
- Chatverlauf: <USERDIR>/users/<user>/chat/history.jsonl

## Troubleshooting

- Mikrofon geht nicht / kein Audio:
  - Nutze https:// oder http://localhost und pruefe Browser-Rechte.

- 401 Access denied:
  - USERDIR in sw/secret/keys.inc.php pruefen.
  - User-Ordner pruefen: <USERDIR>/users/<username>/...

- 500 / OpenAI Request:
  - PHP-cURL aktivieren.
  - Logs unter <USERDIR>/logs/logfile.log pruefen.

- CORS:
  - Aktuell ist Access-Control-Allow-Origin: * gesetzt (Demo). Fuer Produktion einschraenken.

---

##  Organisatorisches

Dies ist ein **privates Open-Source-Projekt** von **JoEmbedded** (Kontakt: [joembedded@gmail.com](mailto:joembedded@gmail.com)).

**Ziel:** Eine flexible, sichere und kostengünstige Alternative zu kommerziellen Voice-Chat-Lösungen  ohne Vendor-Lock-in, mit voller Kontrolle.

**Status:** Funktionsfähiges Fragment (V0.04 / Januar 2026)  produktionsreif mit Feinschliff.

**Feedback & Kooperation willkommen!** 

---

** JoEmbedded.de 2026** | [Live-Demo](https://joembedded.de/x3/minichat/sw/launch.html) | [Installation](install_readme.md) | [GitHub](https://github.com/joembedded)
