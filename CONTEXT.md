# Trene

Trene beskriver registrering av styrkeøvelser og treningsøkter.

## Language

**Treningsøkt** (_Workout_):
En avgrenset treningsperiode der brukeren utfører og registrerer én eller flere øvelser.
_Kortform_: Trening, når sammenhengen er tydelig
_Avoid_: Økt

**Kontekst** (_Training context_):
En navngitt sammenheng som treningsøkter hører til, for eksempel «Fysio» eller «Treningssenter». Hver treningsøkt hører til nøyaktig én kontekst, valgt når den startes. En ny treningsøkt bygger på den siste fullførte treningsøkten i samme kontekst. Den første konteksten heter «Standard».
_Kode_: trainingContext (ikke context, som forveksles med React Context)
_Avoid_: Rutine, treningstype, treningsform, program, mal, økttype

**Arkivert kontekst** (_Archived training context_):
En kontekst som er skjult fra valget når en treningsøkt startes. Treningshistorikken beholdes, og konteksten kan aktiveres igjen.

**Aktiv treningsøkt** (_Active workout_):
En treningsøkt som er startet, men ikke fullført eller avbrutt.
_Avoid_: Pågående treningsøkt

**Fullført treningsøkt** (_Completed workout_):
En treningsøkt brukeren har avsluttet og lagret i treningshistorikken.

**Øvelse** (_Exercise_):
En styrkeaktivitet som kan utføres i ett eller flere sett. Øvelser er felles for alle kontekster.

**Øvelse i treningsøkt** (_Workout exercise_):
En øvelse som er lagt til i en bestemt treningsøkt, med treningens sett og plassering.
_Avoid_: Medlemskap, membership

**Sett** (_Set_):
En planlagt eller gjennomført utførelse av en øvelse.

**Planlagt sett** (_Planned set_):
Et sett som ennå ikke er bekreftet. Det kan inneholde foreslått belastning og antall repetisjoner.
_Avoid_: Ubekreftet sett, unconfirmed set

**Gjennomført sett** (_Completed set_):
Et sett som brukeren har bekreftet med registrert belastning og antall repetisjoner.
_Avoid_: Utført sett, bekreftet sett, confirmed set

**Bekrefte sett** (_Confirm set_):
Handlingen som gjør et planlagt sett til et gjennomført sett.

**Belastning** (_Load_):
Vekten i kilogram som brukes i et sett.
_Avoid_: Vekt, weight, kilo

**Repetisjon** (_Repetition_):
Én fullført utførelse av bevegelsen i en øvelse.
_Avoid_: Rep

**Treningshistorikk** (_Workout history_):
Samlingen av fullførte treningsøkter.
