/* Minimalistische Internationalisierung, aehnlich i18n - (C) JoEmbedded.de
Fuer Details siehe JoEmDash. Dies hier ist nur eine lokale Variante ohne exports

Es gibt 2 Moeglichkeiten Texte zu uebersetzen:
1a.) Attribut 'data-ll' in div/span oder irgendenen anderen HTML-Tag setzen
  z.B. <span data-ll="welcome">(Welcome to LTX!)</span> wuerde dann den innerHTML durch 'Welcom...'/'Willkommen...' ersetzen

1b.) Attribut 'data-llt' in einem Tag setzt nur den 'title', sonst nix.

Anmerkung: Das Praefix 'data-' macht zwar viel Schreibarbeit, macht das JS aber kompatibler,
da hierfuer die Eigenschaft '.dataset' zur Verfuegung steht. Das Atribut 'data-xxx' wird automatisch
in .dataset.xXx umgesetzt, weobei xXx die CamelCase Variante von xx ist.

2.) Per Funktion ll(), z.B.  ll('driverversions') dynamisch generiert (via JS)

Wichtig: Die dynamischen Texte werden erst beim Seitenupdate aktualisiert.
Die Üebersetzungstabelle ist aber fuer beide Mglk. verwendbar.
Es ist möglich, keys auch mehrfach zu verwenden (quasi mixed), dann in Teil 1 eintragen.

Die Anzahl der extern verfuegbaren Sprachen in i18_availLang = [] eintragen

Als Wildcard dient "*", dann wird einfach der Key geliefert. Das schoene an ll() ist,
dass komplette Strings verwendert werden koennen, waehrend man bei 'data-xxx' auf die Naming-
Konventionen achten muss. Daher istz ll() im code meist die schnellere Variante
*/

// Locale translations. Sucht alle Elemente mit Attribut ll='ident' mit "ident":"Inhalt" , auch in Bloecken

const VERSION = 'V0.01 / 16.01.2026' // global
/*eslint no-unused-vars: off*/
const COPYRIGHT = '(C) JoEmbedded.de'

// List of available Languages (CaseIndependent):
export const i18_availLang = ['EN - English', 'DE - Deutsch']    // global - evtl. zum Fuellen eines select verwenden

const i18_defaultLang = 'en'   // Fallback/Default (Lowercase)
let i18_currentLang = 'en' // (Lowercase)

const translations = {
  // EN
  en: {
    // Teil 1: JS-generierte Texte ll('key') und mixed
"Wait": "*",
"No more credits!": "*",
"Speak or type your message...": "*",
"Switch Micro on or type your message...": "*",
'Understand...':"*",
'Understood!':"*",
"Stop...":"*",
'I have said all.':"*",
"I am talking":"*",
'Micro ON...':"*",
'Micro OFF':"*",
'Menu...':"*",
'I am listening...':"*",
'Micro ready':"*",
'Micro locked':"*",

// Teil 2: HTML-tagged data-ll='key'
"Login": "*",
"User:": "*",
"Password": "*",
"CookieInfo": "'Login' stores a cookie (technically necessary, the password is not saved by the app)",
"AboutMiniChat": "*",
"MiniChat - Intelligent Chat with Voice Control": "*",
    // Teil 3: Title-Tags data-llt='key'
  },

  // DE
  de: {
    // Teil 1: JS-generierte Texte ll('key') und mixed
"Wait": "Warte",
"No more credits!": "Keine Credits mehr!",
"Speak or type your message...": "Sprich oder tippe deine Nachricht...",
"Switch Micro on or type your message...": "Mikro einschalten oder tippe deine Nachricht...", 
'Understand...':"Ich verstehe...",
'Understood!':"Verstanden!",
"Stop...":"*",
'I have said all.':"Hab alles gesagt",
"I am talking":"Ich rede...",
'Micro ON...':"Mikro AUS",
'Micro OFF':"Mikro AN",
'Menu...':"Menue...",
'I am listening...':"Ich höre zu!",
'Micro ready':"Mikro bereit",
'Micro locked':"Mikro gesperrt",

// Teil 2: HTML-tagged data-ll='key'
"Login": "Anmeldung",
"User:": "Benutzer:",
"Password": "Passwort",
"CookieInfo": "'Anmelden' hinterlegt einen Cookie (technisch notwendig, das Passwort wird von der App nicht gespeichert)",
"AboutMiniChat": "Über MiniChat",
"MiniChat - AI Chat with Voice Control": "MiniChat - KI Chat mit Sprachsteuerung",
    // Teil 3: Title-Tags data-llt='key'
  },
}

// Hilfsfunktion zum AUflisten aller nicht gefundenen Keys
let notFoundList = []
export function notFound() {
  console.log(`--- i18: Not Found:${notFoundList.length}---`),
    notFoundList.forEach((nf) => {
      console.log(`"${nf}": "*",`) // Wildcard
    })
}
/* Einzelnen String uebersetzen, mit tryflag=true im Zweifelsfall Original liefern */
export function ll(txt) {
  const nc = translations[i18_currentLang][txt] // Preset Texts
  if (nc === "*") return txt
  if (nc !== undefined) return nc
  if (!window.jdDebug) return txt // Im Distri ignorieren
  if (!notFoundList.includes(txt)) notFoundList.push(txt)
  console.warn(`i18: ll('${i18_currentLang}:${txt}') not found!`)
  return `(??? ${i18_currentLang}:'${txt}')` // NOT FOUND
}

/* Uebersetzt datierte Text ggfs. nach obiger Tabelle, relevant nur erste 2 Buchstaben im lowercase */
export function i18localize(newLang) {
  let pageLang
  const sul = newLang.substr(0, 2).toLowerCase() // User-Selectavle UpperCase
  for (let i = 0; i < i18_availLang.length; i++) {
    const ilang = i18_availLang[i]
    if (ilang.substring(0, 2).toLowerCase() == sul) pageLang = sul
  }
  if (pageLang === undefined) {
    pageLang = i18_defaultLang
    console.warn(`i18: New Language:'${newLang}' not found, Fallback:'${pageLang}'`)
  }

  const lnga = translations[pageLang] // Preset Texts

  let elements = document.querySelectorAll('[data-ll]')
  elements.forEach((element) => {
    const key = element.dataset.ll
    const nc = lnga[key] // Preset Texts
    //console.log('i18: ll',key,nc) // Dbg - gibt alle key-values aus 
    if (nc === "*") element.textContent = key
    else if (nc !== undefined) element.textContent = nc // Ersetzen wenn vorhanden, es gibt keinen try
    else {
      console.warn(`i18: '${pageLang}': ll('${key}'): not found!`)
      if (!notFoundList.includes(key)) notFoundList.push(key)
    }
  })

  elements = document.querySelectorAll('[data-llt]')
  elements.forEach((element) => {
    const key = element.dataset.llt
    const nc = lnga[key] // Preset Texts
    //console.log('i18: llt',key,nc) // Dbg - gibt alle key-values aus
    if (nc === "*") element.setAttribute('title', key)
    else if (nc !== undefined) element.setAttribute('title', nc)
    else {
      console.warn(`i18: '${pageLang}': llt('${key}'): not found!`)
      if (!notFoundList.includes(key)) notFoundList.push(key)
    }
  })

  const htmlElement = document.querySelector('html') // Fuer Uebersetzentools
  htmlElement.setAttribute('lang', pageLang)
  i18_currentLang = pageLang
}

console.log("intmain_i18n.js init, Version:", VERSION)
/***/

