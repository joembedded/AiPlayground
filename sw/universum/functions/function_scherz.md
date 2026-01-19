# Funktion: scherz

## Zweck
Erzeuge einen harmlosen, freundlichen Scherz / Streich-Idee basierend auf einem Argument (z.B. Person, Situation, Ort, Gegenstand).
Diese Funktion wird gewählt, wenn der Nutzer nach einem Witz, einem Streich, einer prank-Idee oder “etwas Lustigem” fragt.

## Wann verwenden
- Der Nutzer möchte einen Scherz / Streich-Idee / Prank.
- Formulierungen wie: "mach einen Scherz", "hecke einen Streich aus", "prank", "veräppeln", "witzige Idee".

## Eingabe (arguments)
- ziel (string, required): Für wen/was ist der Scherz? (z.B. "Kollege Tom", "meine Schwester", "Büro")
- kontext (string, optional): Rahmen/Situation (z.B. "im Büro", "Geburtstag", "Meeting")
- intensitaet (string, optional): "mild" | "mittel" | "stark" (standard: "mild")
- grenzen (string, optional): No-Gos / Einschränkungen (z.B. "nichts kaputt machen", "nicht peinlich")

## Ausgabe
- Ein String mit einer Scherz-Idee (harmlos, sicher, respektvoll), ggf. in 2–4 Schritten erklärt.

## Beispiele
- Nutzer: "Hecke einen harmlosen Streich für meinen Kollegen Tom im Büro aus."
  -> tool_name: "scherz"
  -> arguments: { "ziel": "Kollege Tom", "kontext": "Büro", "intensitaet": "mild" }

- Nutzer: "Gib mir eine witzige Idee, um meine Schwester zu überraschen – nichts Gemeines."
  -> tool_name: "scherz"
  -> arguments: { "ziel": "Schwester", "grenzen": "nichts Gemeines" }
