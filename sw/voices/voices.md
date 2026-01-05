### voices.md ###

Dieses Directory enthält Erzähler fürs TTS. 
Für's Hash wird Dateiname + Hash(Text) verwendet
USER und FORMAT wird vom TTS eingetragen

Bsp. 'vilo':
```json
{
  "model": "gpt-4o-mini-tts",
  "voice": "verse",
  "input": "USER",
  "instructions": "Sprich auf Deutsch.\nStimme: ruhig, sehr sanft und warm.",
  "speed": 1,
  "response_format": "FORMAT"
}
```

- `narrator_m_vilo.json`: Sehr ruhiger, männlicher Erzähler 
- `narrator_f_jane.json`: Freundliche Frau
- `narrator_m_jack.json`: Männlich, altes `tts-1` Modell ohne Extras

