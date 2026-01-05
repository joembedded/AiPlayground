# Persona.md

Dieser Ordner enthält Personalisierungen, z.B. die Assistenten und diverse IDs.

> [!NOTE]
> Die `$promptId` ist der zentrale Ankerpunkt in der neuen Responses API. 
> Man kann sie sich als eine Art „Vorlage“ oder „vorkonfigurierten Bot“ vorstellen, 
> der auf den Servern von OpenAI gespeichert ist.

Bsp.: Simjo, ein einfacher Assistent zum Testen: 

`$promptId`: `asst_ImgeBOwxI1vL85VSOaRBggSf` -> gpt-4.1.-nano

Bsp.: Prompt:
```json
{
    "model": "gpt-4.1-nano",
    "prompt": {
        "id": "$promptId"
    },
    "input": [
        {
            "role": "user",
            "content": "Wie lange dauert der Versand?"
        }
    ],
    "response_format": {
        "type": "json_schema",
        "json_schema": "$jsonSchema_WOANDERS_DEFINIERT"
    },
    "conversation": "$conversationId_PRO_UNTERHALTUNG",
    "store": true
}
```

Bsp.: Schema und 
```json
{
    "name": "support_response",
    "strict": true,
    "schema": {
        "type": "object",
        "properties": {
            "answer": {
                "type": "string",
                "description": "Die Antwort basierend auf dem Dokument."
            },
            "meta_info": {
                "type": "object",
                "properties": {
                    "interessiert_an_daten_protokoll": {
                        "type": "boolean"
                    },
                    "interessiert_an_stromverbrauch": {
                        "type": "boolean"
                    },
                    "interessiert_an_lieferzeit": {
                        "type": "boolean"
                    }
                },
                "required": ["interessiert_an_daten_protokoll", "interessiert_an_stromverbrauch", "interessiert_an_lieferzeit"],
                "additionalProperties": false
            }
        },
        "required": ["answer", "meta_info"],
        "additionalProperties": false
    }
}
```

> [!TIP]
> Namen wie `interessiert_an_daten_protokoll` oder `interested_in_deliverytime` kann die KI selbständig erkennen und man kann allse mögliche erfragen: 
> - Wahrscheinlichkeitem 
> - Boolean
> - ...
> Im Zweifel: ChatGPT oder Gemini

Antwort dazu:
```json
{
  "answer": "Unsere Standard-Lieferzeit beträgt 3-5 Werktage.",
  "meta_info": {
    "interessiert_an_daten_protokoll": false,
    "interessiert_an_stromverbrauch": false,
    "interessiert_an_lieferzeit": true
  }
}
```

