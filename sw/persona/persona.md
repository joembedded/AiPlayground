# Persona.md

Dieser Ordner enthält Personalisierungen, z.B. die Assistenten und diverse IDs.

> [!NOTE]
> Zur `$promptId` sie ChatGPT
> Man kann sie sich als eine Art „Vorlage“ oder „vorkonfigurierten Bot“ vorstellen, 
> der auf den Servern von OpenAI gespeichert ist.

Bsp.: Simjo, ein einfacher Assistent zum Testen: 


Bsp.: Prompt:
```json
{
    "model": "gpt-4.1-nano",
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
    //"conversation": "$conversationId_PRO_UNTERHALTUNG",
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
Am von ChatGPT so ists richtig--:
{
  "model": "gpt-4.1-mini",
  "previous_response_id": "resp_04eb65b...",
  "input": "Meine Anschlussfrage"
}


```json
{
    "id": "resp_04eb65b9ad2c937900695b04e2d6e08193bfdbedcaba9867ed",
    "object": "response",
    "created_at": 1767572706,
    "status": "completed",
    "background": false,
    "billing": {
        "payer": "developer"
    },
    "completed_at": 1767572707,
    "error": null,
    "incomplete_details": null,
    "instructions": null,
    "max_output_tokens": null,
    "max_tool_calls": null,
    "model": "gpt-4.1-nano-2025-04-14",
    "output": [
        {
            "id": "msg_04eb65b9ad2c937900695b04e3a2a48193a2b2645b44d1c5e2",
            "type": "message",
            "status": "completed",
            "content": [
                {
                    "type": "output_text",
                    "annotations": [],
                    "logprobs": [],
                    "text": "Ich bin ChatGPT, ein KI-Sprachmodell von OpenAI. Wie kann ich dir heute helfen?"
                }
            ],
            "role": "assistant"
        }
    ],
    "parallel_tool_calls": true,
    "previous_response_id": null,
    "prompt_cache_key": null,
    "prompt_cache_retention": null,
    "reasoning": {
        "effort": null,
        "summary": null
    },
    "safety_identifier": null,
    "service_tier": "default",
    "store": true,
    "temperature": 1,
    "text": {
        "format": {
            "type": "text"
        },
        "verbosity": "medium"
    },
    "tool_choice": "auto",
    "tools": [],
    "top_logprobs": 0,
    "top_p": 1,
    "truncation": "disabled",
    "usage": {
        "input_tokens": 12,
        "input_tokens_details": {
            "cached_tokens": 0
        },
        "output_tokens": 22,
        "output_tokens_details": {
            "reasoning_tokens": 0
        },
        "total_tokens": 34
    },
    "user": null,
    "metadata": {}
}
```

