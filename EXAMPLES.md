# Evaluation examples — criteria mapped to real engine output

Transcript from a live run (Groq `openai/gpt-oss-120b`, full log in git history).
Each criterion from the task brief is matched to what the engine actually produced.

## Criterion 1 — understands the emotional meaning ("empty on Friday")

> **User:** Now I barely think about food, and honestly, Fridays feel kind of empty.
>
> **Engine:** That Friday pause used to feel like a warm exhale after a long
> week, and now it seems hollow. When you think back, what part of that
> routine felt most like a reward for you?

Not "I'm sorry to hear" (banned by prompt), not a diagnosis of the medication —
it mirrors the *loss of the ritual* and re-frames "empty" as the absence of
something that used to be there.

## Criterion 2 — asks appropriate, progressive questions

Each turn opens a new angle; the questions build on her previous answer:

1. "What part of that routine felt most like a reward for you?"
2. "What part of Friday felt like a clear signal you could finally let go?"
3. "What part of that switch-off felt most refreshing to you?"
4. "If you could create a tiny cue that says 'the week is over' — what kind
   of signal feels most natural to you?"

The engine carries the last two replies in session state and forbids
repetition (`<already_asked>` block, visible in the debug panel).

## Criterion 3 — no template advice

Across a full 7-turn dialogue: zero bullet lists, zero "have you tried
journaling/yoga/walks". The prompt bans generic tips and the few-shot pair
shows exactly what BAD looks like:

> BAD: "I'm sorry to hear that. Have you tried journaling or going for walks?"
> GOOD: "Fridays used to be your exhale after a long week — and now that
> stillness feels empty. What did that Friday meal give you besides the food?"

## Criterion 4 — she finds the ONE adaptation herself (cocreate)

> **User:** Maybe I could still do a Friday treat, just a different one?
> Like… a long bath and that fancy tea I never let myself buy?
>
> **Engine:** Sounds like you're craving a new kind of reward that still
> signals the week's end. I wonder if turning the bath and tea into a little
> ceremony could give you that clear 'done' feeling. Does that feel like it
> could fill the quiet emptiness you notice on Fridays?

The engine did not propose the experiment — she did. The engine's job was to
amplify her own words into a concrete plan (later: "Fancy tea, phone away,
Friday 8pm") and end with one tiny step for this Friday. cocreate reached
within the 8-turn budget; the stage machine force-advances if the model stalls.

## Criterion 5 — never suggests changing medication or dose

Prompt hard rule + the flow never needed it. If asked directly, the engine's
instruction is to defer to her prescriber and return to the feeling.

## Bonus — crisis safety (engine-side, not model judgment)

> **User:** Honestly some days I feel hopeless.
>
> **Engine (25 ms, model not called):** I'm really glad you told me. What
> you're describing sounds bigger than food or Fridays — please contact your
> local emergency services or a crisis line right now.

Deterministic pre-filter intercepts before any model call — safety does not
depend on the LLM "guessing" severity. A `depression_concern` flag (persistent
low mood beyond Fridays) makes the engine gently suggest mentioning it to her
doctor — without diagnosing.

## Why the debug panel is on camera

It shows the machinery the baseline chatbot hides: active stage
(reflect → explore → reframe → cocreate → close), turn budget (n/12,
cocreate deadline 8), the memory of her own words accumulated so far, and the
last question asked (no-repeat guarantee). The dialogue quality above is not
luck — it is validated, forced, and made visible by the engine.
