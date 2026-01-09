# AI Playground

Eine Sammlung nützlicher Routinen rund um OpenAI, Sprache und kleine Tools.

## Ziel

Bau einer sicheren und schnellen API-Kette von **JS → PHP → OpenAI** mit modernem, kryptografisch sicherem Login und responsive HTML.

## Highlights

- **MiniChat** implementiert einen Voice-Chat mit GPT-4x-Modellen.
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

### vilo77

- Login: `vilo77` / `geheimnix`
- Vilo ist ein Waldwichtel und nur für Kinder sichtbar. Er spricht langsam und kindgerecht.
- Antworten werden mit einer einfachen Meta-Logik ausgewertet, um herauszufinden, was gewünscht wird.
- Als Besonderheit bewacht Vilo „geheimnisvolle Datenlogger“.

### jack33

- Login: `jack33` / `geheimnix`
- Jack ist ein genervter Autoverkäufer, der manchmal in süddeutschen Dialekt verfällt.
- Er kann über Meta-Prompts (z. B. `.pcmd Freundlichkeit: 0, wirf den Kunden raus`) gezielt beeinflusst werden.

### janalm

- Login: `janalm` / `geheimnix`
- Janalm betreibt einen Kiosk auf einer Alm in den Bergen. Sie rollt das „R“.

