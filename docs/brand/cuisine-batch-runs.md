# Batched Seedance runs — multiple cuisine loops per generation

Budget: 480 credits, 20 per generation. Chinese ✅ done (1 run). One run can
carry several **completely separate 5-second scenes** joined by hard cuts; you
split them at the cuts in Picsart and each becomes its own card loop. Two
scenes per 10s run doubles the cards per credit; three per 15s run triples it
(if the tool offers 15s).

## Read this before spending credits

1. **Test with ONE two-scene run first.** Multi-scene generation is a gamble —
   models sometimes blend scenes, drift the cut off 5.0s, or carry a prop
   across the boundary. If the test looks clean, proceed; if not, singles are
   the safer spend. A failed 3-scene run costs the full 20 credits to retry.
2. **The cut will not land at exactly 5.00s — that's fine.** Trim at the actual
   cut frame. Each scene loops internally, so segment length just needs
   trimming to its own clean cycle.
3. **Don't batch more than 3 scenes.** Beyond that, the failure odds eat the
   savings, and per-scene detail visibly drops.
4. **If one scene in a batch fails,** regenerate just that cuisine as a 5s
   single using its solo prompt from `cuisine-animation-prompts.md` — don't
   re-roll the whole batch.
5. **Priority order:** the site shows 8 kitchens today. Finish those 7 first
   (Batches A–D below = 4 runs = 80 credits). Everything after is pre-stock
   for kitchens that haven't opened — bank the credits unless you're sure.

## The batched style block (replaces the single-scene one)

The single-scene block says "no cuts" — for batches that rule changes to
"exactly one instant cut per scene boundary". Paste this instead:

> Hand-drawn 2D cartoon animation with rich painted detail, warm textured flat
> colours and subtle paper grain, cozy golden light, cookbook-illustration
> style. The video is a sequence of completely separate 5-second scenes joined
> by ONE instant hard cut at each boundary — no transitions, no crossfades, no
> shared objects or backgrounds between scenes. Within each scene: static
> locked camera, all motion cyclical, and the scene's first and last frames
> are identical so each scene is a seamless standalone loop. No text, no
> logos, no flags, no photorealism. Food always vivid and full-colour.

Then append the scene list. Everything else from the global settings still
applies (4:3, palette anchors, one flame-orange element *per scene*).

---

## Batch A — Indian + Italian (10s, 1 run)

> [batched style block]
>
> SCENE 1 (0:00–0:05), Indian kitchen: A small brass tadka pan pours an
> endless sparkling stream of mustard seeds, curry leaves and sizzling golden
> oil into a bowl of creamy yellow dal; where it lands, flame-orange oil
> blooms and swirls in a closed circle; tiny seeds pop with star-like sparkles
> in a steady rhythm; gentle steam rises in repeating wisps; one marigold and
> scattered whole spices rest on a warm cream cloth. The pour never starts or
> ends.
>
> HARD CUT.
>
> SCENE 2 (0:05–0:10), Italian kitchen — entirely new setting, nothing carried
> over: A sunlit marble counter where a hand-cranked pasta machine turns
> steadily as an endless silky golden pasta sheet emerges and folds into neat
> ribbons, the fold pattern repeating in a perfect cycle; beside it only a
> single ripe tomato, one basil sprig, and a small bottle of green-gold olive
> oil, still and proud; a soft linen curtain breathes at a bright window; a
> tiny flame-orange stove pilot glows in the corner. The crank and folds end
> exactly where they began.

## Batch B — Japanese + Korean (10s, 1 run)

> [batched style block]
>
> SCENE 1 (0:00–0:05), Japanese kitchen: A serene wooden counter where a small
> earthen pot of clear golden broth trembles gently over a tiny flame-orange
> flame, one thin thread of steam rising and curling in a repeating pattern; a
> plain indigo curtain sways softly in a doorway behind; a single red maple
> leaf drifts down, dissolves into the steam, and reappears at the branch
> above. Minimal, precise, warm; the final frame matches the first.
>
> HARD CUT.
>
> SCENE 2 (0:05–0:10), Korean rooftop — entirely new setting, nothing carried
> over: A family of round dark clay fermentation jars in golden-hour light;
> the nearest lid sits ajar with brilliant red kimchi peeking out, small
> bubbles rising and popping above it in a slow steady rhythm, the lid rocking
> a millimetre as if breathing; beside it a stone bowl of red stew pumps soft
> steam in repeating billows; one flame-orange ember glows under the stew
> bowl; tiled roofs in deep green shadow behind. Bubbles and steam cycle back
> to the opening frame.

## Batch C — Levantine + Mexican (10s, 1 run)

> [batched style block]
>
> SCENE 1 (0:00–0:05), Levantine table, overhead: A white bowl of thick
> swirled labneh at the centre of a busy mezze table; a slim endless ribbon of
> green-gold olive oil pours from above, tracing the swirl in a closed
> glistening circle that never overflows; pinches of dark za'atar and bright
> herb leaves drift down like confetti in a repeating fall; dappled vine-leaf
> shadows shimmer across the patterned tablecloth; one small flame-orange oil
> lamp flickers at the table's edge. The pour and shadows cycle seamlessly.
>
> HARD CUT.
>
> SCENE 2 (0:05–0:10), Mexican comal — entirely new setting, nothing carried
> over: A clay comal over glowing embers where dark red dried chillies toast
> and gently puff in a slow repeating rhythm, two ropes of blue-grey smoke
> rising and braiding into a repeating pattern; a string of colourful
> cut-paper banners with geometric patterns flutters above in the heat
> shimmer; a volcanic stone mortar waits nearby; one ember pulses flame-orange
> like a heartbeat. Every motion returns exactly to its opening frame.

## Batch D — Thai + Vietnamese (10s, 1 run)

> [batched style block]
>
> SCENE 1 (0:00–0:05), Thai market table: A clay mortar and pestle pound green
> papaya salad in a steady four-beat rhythm, tiny flecks jumping with each
> beat; around the mortar, four items orbit slowly in a perfect circle like
> planets — a red chilli, a halved bright lime, a small amber bottle, a knob
> of golden palm sugar — completing exactly one revolution; behind, a canal
> glitters with repeating sparkles; one flame-orange lantern glows at the
> frame's edge. The orbit and pounding land precisely on the opening frame.
>
> HARD CUT.
>
> SCENE 2 (0:05–0:10), Vietnamese pho stall — entirely new setting, nothing
> carried over: A tall pot of pho broth rolls at a slow boil, charred ginger
> and onion halves bobbing beneath the surface as a ladle dips and arcs broth
> into a waiting bowl of rice noodles; fresh herbs scatter on top in a light
> repeating shower, settling into long curling ribbons of steam; a
> flame-orange ember glows beneath the charring rack, flaring and dimming in
> rhythm. The ladle dips again and the broth settles into its very first slow
> roll.

---

## After the open kitchens: 380 credits = 19 runs = up to 38 more scenes

Build further pairs the same way: take any two entries from
`cuisine-animation-prompts.md`, paste the batched style block, then each
prompt as SCENE 1 / HARD CUT / SCENE 2 with "entirely new setting, nothing
carried over" on the second. Pair *contrasting* scenes (different vessel,
different dominant colour, different motion) — the model separates a pour from
a grind far more cleanly than two steaming pots.

Suggested next pairs (likely-next kitchens): French + Spanish, Greek +
Turkish, Vietnamese is done in Batch D, American + Peruvian, Moroccan +
Ethiopian.

## Three-scene template (only if the tool offers 15s)

Same structure, three scenes, two hard cuts — covers the seven open kitchens
in 3 runs (60 credits) instead of 4:

- Run 1: Indian → Italian → Japanese
- Run 2: Korean → Levantine → Mexican
- Run 3: Thai → Vietnamese → French

Prepend the batched style block, list SCENE 1 (0:00–0:05) / HARD CUT / SCENE 2
(0:05–0:10) / HARD CUT / SCENE 3 (0:10–0:15). Expect more retries at three —
test at two first.
