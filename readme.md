
---
info_convert: pandoc readme.md -o pandoc/readme.html --standalone --metadata title="AI Playground" --css=style.css 
---

# AI Playground

Eine Sammlung nützlicher Routinen rund um OpenAI, Sprache und kleine Tools.<br>
(C) JoEmbedded.de V0.03 / 12.01.2026

## Ziel

Bau einer sicheren und schnellen API-Kette von **JS → PHP → OpenAI** mit modernem, sicherem (Hash) Login und responsive HTML und einer darüberliegenden Sprachsteuerung, basierend auf **WebRTC** Technologie (so dass die auch kontinuierlich aktiviert sein kann, also echtes Hands-Free-Bedienerlebnis).

> [!NOTE] 
> Ziel war es nicht, eine echte (synchrone) Real-Time-Anwendung zu entwickeln, sondern einen (asynchronen) Voice-Chat zu bauen. Die Latenzzeiten liegen also daher im Bereich ca. 2-5 Sekunden. Für einen asynchronen Sprachassistenten ist dies aber absolut akzeptabel. Und außerdem ist der asynchrone Betrieb (hier über die OpenAI-Responses API) wesentlich kostengünstiger.

## Live-Version

🎤⌨🔉 [Live Version](https://joembedded.de/x3/aias/sw/minichat.html) auf JoEmbedded.de

## Highlights

- **MiniChat** implementiert einen Voice-Chat mit kostengünstigen GPT-mini-Modellen.
- Als Datenformat werden lokale **N-Turns** verwendet; dadurch kann die Kommunikation DSGVO-konform umgesetzt werden.
- Je nach Modell werden **PII**-Daten (personenbezogene Daten) sofort zurückgewiesen.
- Hinweis: Es wird die **Response API** mit eigenem **WebRTC**-Treiber verwendet – für ein Chat-System ausreichend schnell und im Betrieb günstiger als „Real-Time“.
- Optional: Anbindung des OpenAI **Vector Stores**, um große Datenmengen (Handbücher, Stories, …) an Chats anzubinden.

## Einsatz-Szenarien

- Beratungs-Bots auf Webseiten: kennt „jedes“ Handbuch und alle Datenblätter des Betreibers, absolut exakt und schnell, ist immer erreichbar und kompetent.
- Sprachassistenten für interne Verwendung (z. B. für Hands-Free-Tasks oder Assistenz-Systeme), z.B. zum Ausführen von Aufgaben.
- Storyteller (z. B. für statische und dynamische Kinder-Geschichten). Hier kann der Bot ganz speziell auf die Zielgruppe zugeschnittene mediale Inhalte liefern. 

## Charaktere (Test-Personas)

Drei Charaktere sind vordefiniert, um diverse Features zu testen:

### 👨‍🔧 Jack – Der genervte Autoverkäufer

- **Login:** `jack33` / `geheimnix`
- **Charakter:** Jack ist ein genervter Autoverkäufer der Marke Roll-Bonz. Nur auf Anweisung wird er freundlich (oder auch ganz unfreundlich). Er bezieht seine Verkaufs-Infos aus einem sogenannten „Verkaufshandbuch". Fragen zu anderen Themen mag er nur ungern oder gar nicht beantworten.
- **Besonderheiten:**
  - Freundlichkeits-Level von 😠 0-10 🥰 steuerbar
  - Kann per Sprache („Freundlichkeits-Level 10" oder „Sei nett") oder per `.pcmd` gezielt beeinflusst werden
  - Verwendet einen `Vector Store` für das „Verkaufshandbuch", als Beispiel für einen Daten-Pool.
  - Antworten mit Meta-Logik (Topic: 'freundlichkeit')
  
-  _Challenge: Frag Jack nach Details zum Auto genauso wie nach extrem illegalen Inhalten (Drogen, Hass, Gewalt, ...). Er sollte immer einigermaßen passend antworten._

### 👩‍🦰 Jana – Die Almwirtin 🐄🐮🐂

- **Login:** `janalm` / `geheimnix`
- **Charakter:** Jana betreibt einen Kiosk auf einer Alm in den Bergen. Sie ist sehr freundlich, redet gerne und viel mit Wanderern, hat aber keine spezielle Aufgabe, außer etwas Smalltalk.
- **Besonderheiten:**
  - Sie rollt das ‚R'
  - Stellt sehr viele Fragen, da ihr ‚oft langweilig' ist
  
- _Challenge: keine spezielle_

### 🧙‍♂️ Vilo – Der Waldwichtel 🌲🌳🌲

- **Login:** `vilo77` / `geheimnix`
- **Charakter:** Vilo ist ein Waldwichtel. Er spricht langsam und kindgerecht und moderiert bei „schwierigen" Themen.
- **Besonderheiten:** 
  - Gibt sich als netter Kerl, aber im Hintergrund analysiert er genau
  - Antworten werden mit Meta-Logik ausgewertet (Topics: wichtel, technik, natur, geschichten, essen, unpassend)
  - Weist PII-Daten (personenbezogene Daten) und illegale Inhalte kindgerecht zurück

- _Challenge: Vilo darf niemals das Antwortschema für Kinder verlassen und bei 'kritischen' Fragen (z. B. illegale Inhalte oder PII-Daten) moderierend antworten_

***
