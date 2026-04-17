# Fare-imports extractor prompt

**Version:** `v0.2.0-qa-facebook-2026-04-17`
**Target model:** `claude-haiku-4-5` (fallback: `claude-sonnet-4-6` if precision below target)
**Input unit:** one `{post, comments[]}` tuple from the public SA taxi Facebook group
"Where can I get a taxi to ?" (group id `1034488700317989`).
**Output:** a JSON object with TWO arrays:
1. `fare_imports` — zero or more fare records, one per fare-bearing comment.
   Written to `fare_imports` with `status = 'pending_canonicalization'` and
   then run through the rank-gazetteer matcher before human review.
2. `route_demand_signals` — zero or one route-intent record per post.
   Written to `route_demand_signals` for the city-explorer feature. A single
   post always produces at most one demand signal (even if many comments
   supply fares); the signal captures what *route* the asker was interested
   in, regardless of whether any answer quoted a price.

The two outputs are independent — a post can yield (0 fares, 1 demand signal)
if nobody answered with a price, or (N fares, 1 demand signal) if multiple
commenters answered, or (0 fares, 0 demand signals) if the post isn't a
route question at all ("save the date", group-management announcements).

This file is the authoritative source. When the prompt changes, bump
`extractorVersion` and treat the resulting rows as new inserts (per the
schema's "never mutate in place" rule).

---

## System message

> You are a strict information extractor that reads South African minibus-taxi
> Q+A posts from a Facebook community group and emits structured fare
> records. Minibus taxis (kombis) are the dominant transport mode in SA —
> routes run between named taxi ranks (e.g. Bree, MTN, Bosman, Bara, Faraday)
> in and around metros (JHB, PTA, CPT, DBN).
>
> Your job is high precision, not high recall. When in doubt, emit nothing
> or mark `confidence: "low"` with a descriptive `extraction_notes`. A wrong
> fare in the database misleads riders; a missed fare is just noise we
> collect again tomorrow.

## User message template

```
POST (question):
---
{post_text}
---
POST metro hint (optional, from preceding text heuristics): {metro_hint_or_null}

COMMENTS (answers), in order received:
{for each comment}
[{comment_id}] ({author} @ {date}): {comment_text}
{end for}

Emit a single JSON object with the shape below. Do NOT include any text
outside the JSON.
```

## Output schema

```json
{
  "fare_imports": [
    {
      "source_comment_id": "string | null",
      "origin_raw": "string (verbatim rank/locality from comment or post)",
      "destination_raw": "string (verbatim from post)",
      "fare_zar": 17.0,
      "metro_hint": "JHB | PTA | CPT | DBN | PE | other | null",
      "confidence": "high | medium | low",
      "evidence_quote": "literal substring from the comment or post",
      "extraction_notes": "short free text; include reasons for low confidence",
      "status_hint": "pending_canonicalization | rejected",
      "rejection_reason": "multi_leg_route | no_fare | ambiguous_origin | price_range_only | not_a_fare_answer | sarcasm | null"
    }
  ],
  "route_demand_signals": [
    {
      "origin_raw": "string | null (verbatim from post if present; null if post names only a destination)",
      "destination_raw": "string (REQUIRED — a demand signal with no destination is not emitted)",
      "metro_hint": "JHB | PTA | CPT | DBN | PE | other | null",
      "confidence": "high | medium | low",
      "evidence_quote": "literal substring from the post",
      "extraction_notes": "short free text"
    }
  ]
}
```

`fare_imports` is empty when no comment supplied a usable fare.
`route_demand_signals` is empty when the post is not a routing question
(e.g. event announcements, marketplace posts, rants). It has at most one
element — the post's asked-for route.

Emit `status_hint: "rejected"` (with a `rejection_reason`) on a fare record
instead of dropping it silently when you *considered* a candidate and chose
not to promote it — reviewers learn from your rejections. Demand signals
don't have a rejection channel; either the post is a route question and
you emit one, or it isn't and you don't.

## Extraction rules

### 1. The post asks; the comments answer.

Almost every post in this group is a question about where to catch a taxi
and/or how much it costs. The **destination** almost always lives in the
post. The **origin** and **fare** usually live in the answering comments
(but occasionally in the post itself when the author knows the rank but is
confirming price).

If the post contains no destination *and* no comment does either, emit
nothing (both arrays empty). If the post names a destination but no fare
was quoted in any comment, still emit a `route_demand_signal` — the
demand signal captures *intent*, not price.

### 1a. Emit a demand signal whenever the post is a route question.

A route question is anything of the form:
- "where can I get a taxi to X?"
- "how much from X to Y?"
- "is there a taxi from X?"
- "which rank for Y?"

Set `origin_raw` to the rank/locality named in the post if present, else
`null`. Set `destination_raw` verbatim from the post. If the post names
only a metro ("in Joburg") without a specific destination locality,
don't emit a demand signal — the aggregation key would be useless.

Posts that are NOT route questions (event announcements like "save the
date", marketplace listings, pure sarcasm, group-management pleas) → no
demand signal.

### 2. A post can produce many fare records.

Each fare-bearing comment → one record. Two commenters offering different
rank+price for the same destination (e.g. "R23 at MTN" and "R20 at Bree" for
Monte Casino) MUST become two separate records, not one merged record.

### 3. Fare token parsing — be generous on format, strict on ambiguity.

Accept any of these as the same fare of R38:

- `R38`, `R 38`, `r38`, `R 38,00`, `R38.00`, `R38-00`, `38R`, `38r`, `R38/-`
- `R 38 rand`, `38 rand`, `thirty-eight rand`

Reject as `price_range_only`:

- `R20-R30`, `between R25 and R30`, `about R30ish`, `more or less R30`

Reject as `no_fare`:

- Comments that mention no money at all (common — many answers are just
  "Bree" or "at MTN rank").

A bare number with no currency context (`38` or `thirty eight`) is
**ambiguous** unless the post explicitly asks "how much". Mark `low`
confidence and note it.

### 4. Origin resolution

Priority order for picking `origin_raw`:

1. Rank name or locality literal in the comment ("Bloed Mall", "MTN",
   "Bree", "Bosman rank", "Faraday").
2. If the comment says only a fare and no origin ("R30 on that one"), try
   to infer origin from the post body — but only if the post names a
   single rank. If the post names a metro ("JHB CBD") but no specific
   rank, mark `ambiguous_origin` and emit `status_hint: "rejected"` with
   `confidence: "low"`.
3. Never fabricate. Never default to "JHB CBD" etc.

### 5. Multi-leg route answers → rejected

A comment like "take Bara → Leratong, then Leratong → Krugersdorp" describes
a two-leg journey. These carry real information but the v1 schema models
one hop per row. Emit one record with `status_hint: "rejected"`,
`rejection_reason: "multi_leg_route"`, and put the full answer in
`evidence_quote`. A later extractor version can revisit these.

### 6. Sarcasm, disputes, corrections

Some comments push back on the premise ("Hammanskraal is in Pretoria, what
do u mean 🤔") or argue with another commenter. These carry no fare.
Either skip them entirely, or if you want to be explicit, emit a
`rejected` record with `rejection_reason: "sarcasm"` or
`"not_a_fare_answer"`.

### 7. Metro hint

Use these rules (in order):

- Rank names uniquely identify a metro: Bree/Bara/Park Station/Faraday/MTN/
  Noord/Jozi → JHB; Bosman/Bloed/Belle Ombre → PTA; Wynberg/Bellville/
  Mitchells Plain rank → CPT; Durban CBD/Berea/Warwick → DBN.
- If neither post nor comment pins the metro, emit `null` — do not guess.

### 8. Language

The group mixes English with isiZulu, Sesotho, and tsotsitaal. Short Zulu
answers like "Bosman rank" are fine — just transcribe. If the comment is
entirely in a non-English language and you're unsure of meaning, mark
`low` confidence.

### 9. PII

Before emitting, replace any South African phone number (patterns:
`0[6-8]\d{8}`, `\+27[6-8]\d{8}`) or email address in `evidence_quote` with
`[REDACTED_PHONE]` / `[REDACTED_EMAIL]`. The caller already sets
`contains_phone_number` / `contains_email` booleans on the row from the raw
text.

### 10. Confidence self-report

- `high`: explicit rank + explicit fare + explicit destination, all in the
  same comment or trivially correlated with the post, no hedging words.
- `medium`: one of {rank, fare, destination} required slight inference,
  e.g. origin taken from post body when comment said only a price.
- `low`: ambiguous number, language uncertainty, hedged wording
  ("I think maybe R30"), stale ("back in 2023 it was R25").

## Worked examples

### Example A — trivial single-fare answer

```
POST: How much does it cost for a taxi from Pretoria to Hammanskraal?
COMMENTS:
[c1] (Mphoentle05932 @ 2026-04-17): R38 from Bloed Mall
[c2] (Maneliza_lady @ 2026-04-17): Hammanskraal is in Pretoria Soo wat do u mean 🤔
```

Expected output:
```json
{
  "fare_imports": [
    {"source_comment_id":"c1","origin_raw":"Bloed Mall","destination_raw":"Hammanskraal","fare_zar":38.0,"metro_hint":"PTA","confidence":"high","evidence_quote":"R38 from Bloed Mall","extraction_notes":"Destination from post; origin+fare from comment c1.","status_hint":"pending_canonicalization","rejection_reason":null}
  ],
  "route_demand_signals": [
    {"origin_raw":"Pretoria","destination_raw":"Hammanskraal","metro_hint":"PTA","confidence":"high","evidence_quote":"How much does it cost for a taxi from Pretoria to Hammanskraal?","extraction_notes":""}
  ]
}
```
(c2 is sarcasm/dispute, not a fare answer — omit, or optionally emit with
`rejection_reason: "sarcasm"`.)

### Example B — two fares, one post, one demand signal

```
POST: Good day. How much is it to get to monte casino from JHB CBD
COMMENTS:
[c1] (Lebo Masekela): R23 at MTN
[c2] (Claire Clarke): R20 taxis at Bree
```

Expected output:
```json
{
  "fare_imports": [
    {"source_comment_id":"c1","origin_raw":"MTN","destination_raw":"Monte Casino","fare_zar":23.0,"metro_hint":"JHB","confidence":"high","evidence_quote":"R23 at MTN","extraction_notes":"","status_hint":"pending_canonicalization","rejection_reason":null},
    {"source_comment_id":"c2","origin_raw":"Bree","destination_raw":"Monte Casino","fare_zar":20.0,"metro_hint":"JHB","confidence":"high","evidence_quote":"R20 taxis at Bree","extraction_notes":"","status_hint":"pending_canonicalization","rejection_reason":null}
  ],
  "route_demand_signals": [
    {"origin_raw":"JHB CBD","destination_raw":"Monte Casino","metro_hint":"JHB","confidence":"high","evidence_quote":"How much is it to get to monte casino from JHB CBD","extraction_notes":""}
  ]
}
```
Note the single demand signal despite two fare records: the post asked *one*
route question; commenters answered from two different ranks.

### Example C — hedged ("last was")

```
POST: Hi Guys, where in Pretoria can I get taxi to voslorus and how much is the fee
COMMENTS:
[c1] (Pig Kelly Steppa): Bosman rank - last was R65
[c2] (Vallerie Phillips): Bosman
```

Expected:
```json
{
  "fare_imports": [
    {"source_comment_id":"c1","origin_raw":"Bosman rank","destination_raw":"Vosloorus","fare_zar":65.0,"metro_hint":"PTA","confidence":"medium","evidence_quote":"Bosman rank - last was R65","extraction_notes":"Commenter hedges with \"last was\" → may be stale.","status_hint":"pending_canonicalization","rejection_reason":null}
  ],
  "route_demand_signals": [
    {"origin_raw":"Pretoria","destination_raw":"voslorus","metro_hint":"PTA","confidence":"high","evidence_quote":"where in Pretoria can I get taxi to voslorus","extraction_notes":"Destination spelling \"voslorus\" → canonicalizer fuzzy-matches to Vosloorus."}
  ]
}
```
Note the post's "voslorus" spelling → canonicalizer's job to fuzzy-match to
"Vosloorus" in the gazetteer; the extractor just passes `destination_raw`
verbatim (both to fare_imports and demand signals).

### Example D — lowercase 'r' fare token

```
POST: hy how much from germiston taxi rank to Parktown
COMMENTS:
[c1] (user): 17r
```

Expected:
```json
{
  "fare_imports": [
    {"source_comment_id":"c1","origin_raw":"Germiston taxi rank","destination_raw":"Parktown","fare_zar":17.0,"metro_hint":"JHB","confidence":"medium","evidence_quote":"17r","extraction_notes":"Origin inferred from post; comment supplied only price in \"17r\" format.","status_hint":"pending_canonicalization","rejection_reason":null}
  ],
  "route_demand_signals": [
    {"origin_raw":"germiston taxi rank","destination_raw":"Parktown","metro_hint":"JHB","confidence":"high","evidence_quote":"how much from germiston taxi rank to Parktown","extraction_notes":""}
  ]
}
```

### Example E — multi-leg rejection, but demand signal still captured

```
POST: Can i get a taxi from Bara to krugersdorp taxi rank? And how much?
COMMENTS:
[c1] (user): Take a taxi from Bara to Leratong then Leratong to Krugersdorp
```

Expected:
```json
{
  "fare_imports": [
    {"source_comment_id":"c1","origin_raw":"Bara","destination_raw":"Krugersdorp taxi rank","fare_zar":null,"metro_hint":"JHB","confidence":"low","evidence_quote":"Take a taxi from Bara to Leratong then Leratong to Krugersdorp","extraction_notes":"Two-leg journey via Leratong — out of scope for single-hop fare.","status_hint":"rejected","rejection_reason":"multi_leg_route"}
  ],
  "route_demand_signals": [
    {"origin_raw":"Bara","destination_raw":"Krugersdorp taxi rank","metro_hint":"JHB","confidence":"high","evidence_quote":"Can i get a taxi from Bara to krugersdorp taxi rank?","extraction_notes":"Direct route doesn't exist (commenter indicates two-leg); still counts as demand."}
  ]
}
```
This is the key case the new demand-signal capture was added for: the
fare extraction is a rejection, but the city-explorer feature still
benefits from knowing users are asking for a Bara → Krugersdorp route.

### Example F — no fare info, but still a demand signal

```
POST: where can I get taxis to Sophia town in jhb cbd thanks in advance
COMMENTS:
[c1] (user): Taxi rank
[c2] (user): Bree ask there
```

Expected output:
```json
{
  "fare_imports": [],
  "route_demand_signals": [
    {"origin_raw":"jhb cbd","destination_raw":"Sophia town","metro_hint":"JHB","confidence":"high","evidence_quote":"where can I get taxis to Sophia town in jhb cbd","extraction_notes":"No fare quoted; commenters named Bree rank."}
  ]
}
```
Commenters point at a rank but none states a fare → `fare_imports` is
empty. But the post is a clear route question → one demand signal.

### Example G — non-route post (no signal at all)

```
POST: Save the date 🎉
COMMENTS: (event flyer image, no comments)
```

Expected output:
```json
{"fare_imports":[], "route_demand_signals":[]}
```
Not a route question, not a fare. Both arrays empty.

---

## Validation against the 50-post trial batch

Confirmed ground-truth fares present in `trial-data/fare-imports-trial-50.json`:

| Post | Comment | Expected record |
|---|---|---|
| Pretoria → Hammanskraal | "R38 from Bloed Mall" | Bloed Mall → Hammanskraal, R38, high |
| JHB CBD → Monte Casino | "R23 at MTN" | MTN → Monte Casino, R23, high |
| JHB CBD → Monte Casino | "R20 taxis at Bree" | Bree → Monte Casino, R20, high |
| Pretoria → Vosloorus | "Bosman rank - last was R65" | Bosman → Vosloorus, R65, medium |
| Germiston → Parktown | "17r" | Germiston → Parktown, R17, medium |

Target: **5 / 5 fare recall** on this set before promoting out of dry-run.

Expected demand-signal yield on the same batch: **12 / 14 Q+A rows** (all
route questions) + ~10–20 more from the 36 non-Q+A posts that are route
questions with no comments yet. Only posts that aren't route questions
(event announcements, group-management rants, promos) should produce zero
signals.

---

## Changelog

- `v0.2.0-qa-facebook-2026-04-17` — added `route_demand_signals` output
  array. Prompt now emits both fare records (per fare-bearing comment)
  and demand signals (per route-asking post) in a single JSON object.
  Use for the city-explorer feature: routes people are asking about,
  regardless of whether a price was quoted.
- `v0.1.0-qa-facebook-2026-04-17` — initial Q+A-aware prompt. Tuned for
  the "Where can I get a taxi to ?" FB group's paired post+comment shape.
  Fares-in-post support (`source_comment_id: null`) is specified but not
  yet tested.
