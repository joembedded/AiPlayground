# AI Playground

Eine Sammlung nützlicher Routinen rund um OpenAI, Sprache und kleine Tools.<br>
(C)JoEmbedded.de V0.01 / 10.01.2026

## Ziel

Bau einer sicheren und schnellen API-Kette von **JS → PHP → OpenAI** mit modernem, kryptografisch sicherem Login und responsive HTML.

## Live-Version

🎤⌨🔉 [Live Version](https://joembedded.de/x3/aibot/sw/minichat.html) auf JoEmbedded.de

## Highlights

- **MiniChat** implementiert einen Voice-Chat mit kostengünstigen GPT-4x-Modellen.
- Als Datenformat werden lokale **N-Turns** verwendet; dadurch kann die Kommunikation DSGVO-konform umgesetzt werden.
- Je nach Modell werden **PII**-Daten (personenbezogene Daten) sofort zurückgewiesen.
- Hinweis: Es wird die **Response API** mit eigenem **WebRTC**-Treiber verwendet – für ein Chat-System ausreichend schnell und im Betrieb günstiger als „Real-Time“.
- Optional: Anbindung des OpenAI **Vector Stores**, um große Datenmengen (Handbücher, Stories, …) an Chats anzubinden.

## Einsatzideen

- Beratungs-Bots auf Webseiten: kennt „jedes“ Handbuch und Datenblatt des Betreibers, ist erreichbar und kompetent.
- Sprachassistenten für interne Verwendung (z. B. für Hands-Free-Tasks oder Assistenz-Systeme).
- Storyteller (z. B. für statische und dynamische Kinder-Geschichten).

## Charaktere (Test-Personas)

Drei Charaktere sind vordefiniert, um diverse Features zu testen:

### 👨‍🔧 jack33 – Der genervte Autoverkäufer

- **Login:** `jack33` / `geheimnix`
- **Charakter:** Jack ist ein genervter Autoverkäufer 
- **Besonderheiten:**
  - Freundlichkeits-Level von 😠 0-10 🥰 steuerbar
  - Kann per Sprache („Freundlichkeits-Level 10" oder „Sei nett") oder per `.pcmd` gezielt beeinflusst werden
  - Verwendet den `Vector Store` für Fahrzeug-Informationen
  - Antworten mit Meta-Logik (Topic: freundlichkeit)

### 👩‍🦰 janalm – Die Almwirtin 🐄⛰🐮

- **Login:** `janalm` / `geheimnix`
- **Charakter:** Jana betreibt einen Kiosk auf einer Alm in den Bergen. Sie ist sehr freundlich, redet gerne und viel mit Wanderern.
- **Besonderheiten:**
  - Sie rollt das 'R'
  - Stellt sehr viele Fragen, da ihr 'oft langweilig ist'

### 🧙‍♂️ vilo77 – Der Waldwichtel 🌲🌳🌲

- **Login:** `vilo77` / `geheimnix`
- **Charakter:** Vilo ist Waldwichtel. Er spricht langsam und kindgerecht.
- **Besonderheiten:** 
  - Gibt sich als netter Kerl, aber im Hintergrund analysiert er genau
  - Antworten werden mit Meta-Logik ausgewertet (Topics: wichtel, technik, natur, geschichten, essen, unpassend)
  - Weist PII-Daten und illegale Inhalte strikt zurück

***
