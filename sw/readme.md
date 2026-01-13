#  AI Playground  MiniChat
### Dein persönlicher Voice-Chat-Assistent mit OpenAI-Power

> **Vollständige Kontrolle. DSGVO-konform. Low-Budget**

Eine flexible Plattform für intelligente Sprachassistenten  von Storytelling über Hands-Free-Support bis hin zu Experten-Beratung.

---

##  Warum AI Playground?

Große Anbieter sind toll  aber was, wenn du **volle Kontrolle** über deine KI-Anwendung brauchst? Wenn Datenschutz wichtig ist? Wenn du die Kosten im Griff behalten willst?

**AI Playground / MiniChat** bietet dir genau das:

 **DSGVO-konform**  Deine Daten bleiben auf deinem Server  
 **Kostentransparenz**  Absolute Transparenz bei Deinen OpenAI-Tokens, das KI Modell kann passend zum Budget/Anforderung gewählt werden. Für viele Anwendungen sind die kleineren Modelle wesentlich günstiger.
 **Freie Programmierung**  Passe Personas, Logik und Features individuell an  
 **Voice-First**  WebRTC-basierte Sprachsteuerung für echtes Hands-Free-Erlebnis  
 **Professionell & sicher**  Hash-Login, Session-Management, API-Sicherheit

---

##  Einsatz-Szenarien

###  **Storyteller für Kinder**
Erzähle dynamische, interaktive Geschichten  vollständig kontrollierbar und kindgerecht. Der Bot kennt jedes Detail der Story, kann Fragen beantworten und vorlesen stundenlang, und alles mit derselben Stimme.

**Beispiel:** "Erzähl mir eine Geschichte aus dem Wald": Vilo, der Waldwichtel, moderiert kindgerecht und passt sich dem Gespräch an.

###  **Hands-Free-Assistent**
Perfekt für Werkstatt, Küche oder Labor: "Was kommt als nächste Zutat in den Teig?", "Drucke das Etikett aus", "Lass das Rollo hoch", ...  Immer verfügbar, ohne die Hände zu benutzen.

###  **Experten-Beratung im Intranet**
Verbinde deinen Assistenten mit Vector Stores (Handbücher, Datenblätter, FAQs). Er kennt jedes Detail  schneller und präziser als jeder Mitarbeiter.

**Beispiel:** Jack, der Autoverkäufer, kennt das komplette Verkaufshandbuch von Roll-Bonz  und antwortet auch bei kritischen Fragen immer passend, wenn auch durchweg schlecht gelaunt. Das ist Absicht.

---

##  Features & Highlights

###  Voice-Chat mit WebRTC
- Kontinuierliche Sprachsteuerung (Hands-Free)
- Speech-to-Text (STT) und Text-to-Speech (TTS) via OpenAI
- Anpassbare Rauschunterdrückung

###  Personas  Charaktere mit Persönlichkeit
Definiere deine eigenen Charaktere mit:
- **Individuellem Sprachstil** (z. B. Jana rollt das 'R', Vilo spricht langsam)
- **Meta-Logik** zur Gesprächssteuerung (z. B. Freundlichkeits-Level bei Jack)
- **Vector Stores** für Wissensanbindung

###  Sicherheit & Datenschutz
- Session-basiertes Login mit Hash-Passwörtern
- Lokale N-Turn-Speicherung auf deinem Server (DSGVO-konform)
- Keine gespeicherten Daten auf externen Servern

###  Kostenoptimiert
- Wahlweise GPT-4.1-nano/mini oder GPT-5-nano/mini
- Asynchrone Response API (wesentlich kostengünstiger als Realtime)
- Token-Tracking in Echtzeit

###  Admin-Tools inklusive
- User-Verwaltung
- Persona-Templates
- Debugging-Tools (Express-Chat, Login-Monitor, Voice-Tests)

---

##  Live-Demo & Charaktere

 🎤⌨🔉 **[Live-Version ausprobieren](https://joembedded.de/x3/xxxx/sw/minichat.html)**

### Vordefinierte Demo-Personas

####  **👨‍🔧 Jack  Der genervte Autoverkäufer**
🔊 [Sprechprobe anhören](./assets/jack.opus)

Jack  verkauft Roll-Bonz-Autos  mal freundlich, mal genervt (steuerbar via Sprache oder `.pcmd`). Er nutzt einen Vector Store für sein Verkaufshandbuch und kann auch bei unpassenden Fragen passend reagieren.

**Highlights:**
- Freundlichkeits-Level  😠 0-10 🥰 steuerbar, kann per Sprache („Freundlichkeits-Level 10" oder „Sei unfreundlich" oder „Sei nett") oder per `.pcmd` gezielt beeinflusst werden
- Meta-Logik für Dialogsteuerung

-  _Challenge: Frag Jack nach Details zum Auto genauso wie nach extrem illegalen Inhalten (Drogen, Hass, Gewalt, ...). Er sollte immer einigermaßen passend und genervt antworten._

---

####  **👩‍🦰 Jana – Die Almwirtin 🐄🐮🐂**
🔊 [Sprechprobe anhören](./assets/jana.opus)

Jana betreibt einen Alm-Kiosk und liebt Smalltalk. Sie rollt das 'R' und stellt viele Fragen, weil ihr oft langweilig ist.

**Highlights:**
- Viel Gesprächsbereitschaft

---

####  **🧙‍♂️ Vilo – Der Waldwichtel vom Sandsee🌲🌳🌲**
🔊 [Sprechprobe anhören](./assets/vilo.opus)

Vilo wohnt am Sandsee bei Baden-Baden und erzählt kindgerecht Geschichten. Er analysiert im Hintergrund das Gespräch und moderiert bei kritischen Themen.

**Highlights:**
- Meta-Logik (exemplarische Topics: wichtel, technik, natur, geschichten, essen, unpassend)
- PII-Filterung (personenbezogene Daten werden kindgerecht abgewiesen)
- Lore-Books für komplette Story-Universen

- _Challenge: Vilo darf niemals das Antwortschema für Kinder verlassen und bei 'kritischen' Fragen (z. B. illegale Inhalte oder PII-Daten) moderierend antworten_

---

####  **👨 Fabi - Die neutrale Teststimme**
🔊 [Sprechprobe anhören](./assets/fabi.opus)

Fabi testet die unfiltrierten" Modelle GPT-4.1/5-nano/mini ohne Meta-Anweisungen  ideal, um Modellverhalten und Token-Verbrauch zu vergleichen.

---

##  Technologie-Stack

```
Browser (HTML/JS)  PHP API  OpenAI
```

- **Frontend:** Responsive HTML5, WebRTC, moderne JS (ES6+)
- **Backend:** PHP 8.x 
- **KI:** OpenAI GPT-4.1 / GPT-5 (nano/mini)
- **Speicherung:** Lokaler Server JSONL-Dateien (N-Turns)

> **Hinweis:** Latenz ca. 2 - 5 Sekunden (asynchron)  perfekt für Voice-Chat, günstiger als Realtime-API.

---


##  Organisatorisches

Dies ist ein **privates Open-Source-Projekt** von **JoEmbedded** (Kontakt: [joembedded@gmail.com](mailto:joembedded@gmail.com)).

**Ziel:** Eine flexible, sichere und kostengünstige Alternative zu kommerziellen Voice-Chat-Lösungen  ohne Vendor-Lock-in, mit voller Kontrolle.

**Feedback & Kooperation willkommen!** 

---

** (C) JoEmbedded.de ** | [Live-Demo](https://joembedded.de/x3/minichat/sw/launch.html) | [Installation](install_readme.md) | [GitHub](https://github.com/joembedded)
