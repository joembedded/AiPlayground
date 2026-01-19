# Funktion: rechnung

## Zweck
Führe eine einfache Berechnung oder Zähl-/Auswertelogik basierend auf einem Argument aus.
Diese Funktion wird gewählt, wenn der Nutzer explizit eine Berechnung, Zählung oder ein Ergebnis (Zahl) verlangt.

## Wann verwenden
- Der Nutzer möchte rechnen, zählen oder auswerten.
- Formulierungen wie: "berechne", "rechne", "wie viele", "zähle", "ermittle", "Summe", "Differenz".
- Beispiel: Buchstaben in einem Namen zählen.

## Eingabe (arguments)
- operation (string, required): Art der Berechnung
  - Erlaubte Werte (Beispiele): "buchstaben_zaehlen", "quersumme", "laenge", "summe"
- input (string, required): Eingabewert für die Berechnung (z.B. Name, Text oder Zahl als String)
- optionen (object, optional): Zusatzoptionen
  - ignore_spaces (boolean, optional): Leerzeichen ignorieren (default: true)
  - ignore_umlaute (boolean, optional): Umlaute normalisieren (ä->a etc.) (default: false)

## Ausgabe
- Ein String oder eine Zahl (je nach Implementierung), z.B. "Der Name hat 6 Buchstaben." oder einfach 6.

## Beispiele
- Nutzer: "Zähle die Buchstaben in 'Jürgen'."
  -> tool_name: "rechnung"
  -> arguments: { "operation": "buchstaben_zaehlen", "input": "Jürgen", "optionen": { "ignore_spaces": true } }

- Nutzer: "Wie viele Zeichen hat 'Hallo Welt' ohne Leerzeichen?"
  -> tool_name: "rechnung"
  -> arguments: { "operation": "laenge", "input": "Hallo Welt", "optionen": { "ignore_spaces": true } }
