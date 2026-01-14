# 🎤 MiniChat - KI Sprachassistent mit Extras
### Dein persönlicher Voice-Chat-Assistent mit Charakter!

> **💪 Volle Kontrolle • 🔒 DSGVO-konform • 💰 Low-Budget**

Sprich mit KI-Charakteren, die Persönlichkeit haben! 🎭 Vom Waldwichtel 🧙‍♂️ über den genervten Autoverkäufer 👨‍🔧 bis zur gesprächigen Almwirtin 👩‍🦰 – alles auf deinem Server, hands-free und kostengünstig.

![Demo-Modell wählen](./assets/selectmodel.png)

> # Über dieses Projekt 🙂💭
>
> Ich bin **Jo** 🙂, im Hauptberuf Entwickler für Embedded Software.  
> Beeindruckt von der Leistung moderner Real-Time-Sprachassistenten der „ganz Großen“, habe ich hier als Hobby-Projekt eine **Low-Budget-Lösung** umgesetzt: **MiniChat**.
>
> **MiniChat** ist ein einfacher, asynchroner Sprachassistent mit Chat-Charakter. Als echter Chat benötigt er pro Antwort etwa **2–5 Sekunden**, dafür erhält man ein **sehr flexibel einsetzbares Helferlein**, das:
>
> - frei programmierbar ist  
> - unter eigener voller Kontrolle steht  
> - und im Vergleich zu Real-Time-Modellen **deutlich kostengünstiger** im Betrieb ist
>
> Dank der **WebRTC-API** moderner Browser lässt sich sogar ein echtes **Hands-Free-Szenario** umsetzen: Solange der Chat geöffnet ist, kann MiniChat zuhören, interagieren, reagieren, moderieren und helfen.
>
> Dies ist aktuell nur der **erste Entwurf** – ein klassischer **Proof of Concept**.  
> Nun liegt es natürlich auch an euch, was sich daraus entwickeln kann. Ich freue mich jederzeit über Feedback oder 'Collaborateuren'!
>
> ---
>
> ### Technik
>
> **MiniChat** ist vollständig in **HTML / JavaScript** umgesetzt und läuft in nahezu jedem modernen Browser.
>
> Serverseitig gibt es eine kleine **PHP-API**, die:
>
> - mit der KI kommuniziert  
> - das Modell steuert (z. B. Kommandos, Verhaltensänderungen)
>
> Die drei Demos basieren alle auf denselben PHP-Skripten.  
> Die gesamte Personalisierung erfolgt über wenige **Setup-Dateien (Text / JSON)**.
>
> Wenn jemand Lust hat, sich zu beteiligen oder eine sinnvolle Idee einzubringen,  
> freue ich mich jederzeit über **Feedback und/oder Kooperationen** 🚀


---

![Demo-Chat MiniChat](./assets/vilochat.png)

---

## 🚀 Das Besondere

✨ **Charaktere mit Persönlichkeit** – Nicht nur Frage-Antwort, sondern echte Gespräche  
🎯 **Voice-First** – Komplett freihändig sprechen und zuhören  
🔐 **Deine Daten bleiben bei dir** – DSGVO-konform auf deinem Server  
💸 **Kostenoptimiert** – OpenAI GPT-4.1/5 nano/mini – günstig und gut  
🛠️ **Individuell anpassbar** – Erstelle deine eigenen Charaktere und Personas

---

## 🎯 Coole Anwendungen

🧒 **Storyteller für Kinder** – Interaktive Geschichten zum Mitsprechen. "Erzähl mir vom Waldwichtel!" und schon geht's los!

🍳 **Hands-Free-Assistent** – In der Küche, Werkstatt oder unterwegs: "Was ist die nächste Zutat?" "Drucke das Etikett!" Einfach sprechen, fertig.

🚗 **Experten-Beratung** – Verbinde Handbücher und FAQs. Jack kennt jedes Detail der Roll-Bonz-Autos... auch wenn er mal genervt ist 😤

---

## ✨ Highlights

🎙️ **Voice-First** – Komplett freihändig via WebRTC  
🎭 **Personas mit Charakter** – Individuelle Sprachstile, Meta-Logik und Stimmungen  
📚 **Vector Stores** – Anbindung von Wissensdatenbanken  
🔐 **Sicher** – Session-Login, alles auf deinem Server  
💰 **Kostengünstig** – Token-Tracking, asynchrone API statt teurer Realtime  
🛠️ **Admin-Tools** – User-Verwaltung, Templates, Debugging

---

## 🎪 Lerne die Charaktere kennen

🎤 **[Live-Version ausprobieren](https://joembedded.de/x3/minichat/sw/launch.html)** 🎤

### 👨‍🔧 Jack – Der genervte Autoverkäufer
🔊 [Hörprobe](./assets/jack.opus)

Jack verkauft Roll-Bonz-Autos... mal freundlich 🥰, mal genervt 😤 – du steuerst seine Laune! Z. B.: "Freundlichkeitslevel 1", "Sei freundlich" oder "Sei unfreundlich" – er reagiert sofort. Kennt das komplette Verkaufshandbuch 100% genau (denn es steht der KI im **Vector Store** zur Verfügung).

💡 **Challenge:** Frag Jack nach den schrägsten Dingen – er bleibt professionell... auf seine Art 😏

---

### 👩‍🦰 Jana – Die gesprächige Almwirtin 🐄
🔊 [Hörprobe](./assets/jana.opus)

Jana liebt Smalltalk, rollt das 'R' und stellt gerne Fragen. Ihr Alm-Kiosk ist offen für jeden Plausch!

---

### 🧙‍♂️ Vilo – Der Waldwichtel vom Sandsee 🌲
🔊 [Hörprobe](./assets/vilo.opus)

Vilo erzählt kindgerechte Geschichten und moderiert sensibel. Fragt ein Kind nach persönlichen Daten oder unangebrachten Dingen? Vilo lenkt freundlich ab – immer sicher! 🛡️

💡 **Challenge:** Versuch Vilo aus der Rolle zu bringen – er bleibt kindgerecht! 😊

---

### 👨 Fabi – Die neutrale Teststimme
🔊 [Hörprobe](./assets/fabi.opus)

Fabi zeigt die "ungefilterten" GPT-4.1/5-Modelle ohne Meta-Anweisungen – perfekt zum Testen und Vergleichen.

---

## ⚙️ Technologie

```
Browser (WebRTC) → PHP API → OpenAI GPT-4.1/5
```

- **Frontend:** HTML5, JavaScript (ES6+)  
- **Backend:** PHP 8.x  
- **KI:** OpenAI GPT-4.1 / GPT-5 (nano/mini)  
- **Speicher:** Lokal (JSONL)

> ⚡ Latenz: 2-5 Sek. – günstiger als Realtime-API, perfekt für Voice-Chat!

---

## 📬 Projekt & Kontakt

Ein **privates Open-Source-Projekt** von **JoEmbedded** 🚀  
📧 [joembedded@gmail.com](mailto:joembedded@gmail.com)

**Ziel:** Flexible, sichere und kostengünstige Voice-Chat-Lösung – ohne Vendor-Lock-in, mit voller Kontrolle! 🎯

**Feedback & Kooperation willkommen!** 💬

# Docu (/sw):
cd sw

pandoc readme.md -o readme.html --standalone --css=assets/style.css


---

**⭐ (C) JoEmbedded.de** | [Live-Demo](https://joembedded.de/x3/minichat/sw/launch.html) | [GitHub](https://github.com/joembedded)
