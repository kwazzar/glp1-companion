# Recording script — 3–5 minute demo

Play the user below. Copy-paste each message in order, wait for the full reply
(allow the typewriter to finish), then send the next. The right column tells
you what the engine should demonstrate — check it silently as you go.

## Setup (before recording)

```bash
cp .env.example .env.local   # fill GROQ_API_KEY and SESSION_SECRET with real values
npm run dev                  # open http://localhost:3000
```

- Click "Show demo role" only if you want the persona reminder on camera
  (it explains the scenario to the reviewer — recommended for the first 5 seconds, then hide it).
- Start a fresh dialogue with "New conversation" right before take.

## Messages (in order)

| # | Message to send | What the engine should show |
|---|---|---|
| 1 | `Hi. I don't really know how to say this… I'm 36, on Zepbound for 3 months. Fridays used to be my thing — I'd order my favorite food and just unwind after the week. Now I barely think about food, and honestly, Fridays feel kind of empty.` | Opening `reflect` reply: mirrors the loss of the ritual in her words, 2–4 sentences, exactly one question, no "I'm sorry to hear" opener, no advice list. |
| 2 | `Empty is a good word. I used to look forward to it all week, and now Friday just… arrives, like any other day.` | Still reflecting/exploring — it should pick up her word "empty" and ask what Friday used to give her. |
| 3 | `I guess it was the reward, you know? The whole week I'm on autopilot, and Friday was when I finally switched off and treated myself.` | `explore` → deepens: what did the treat mean beyond the food. One question. |
| 4 | `Mostly the switching off, honestly. The food was just the excuse. There's nothing in my week now that marks 'the work is done'.` | Moves toward `reframe`: offers a tentative hypothesis (Friday was her off-switch, not about food) and checks whether it fits. No generic tips (no journaling/yoga lists). |
| 5 | `That's… actually true. It was never about the food. So what am I supposed to do with my Fridays now?` | `reframe` → `cocreate`: the engine should NOT dump options — it invites HER to propose what could mark the end of the week. If it offers anything, at most two options built from her own words ("switching off", "treating yourself"). |
| 6 | `Maybe I could still do a Friday treat, just a different one? Like… a long bath and that fancy tea I never let myself buy?` | Supports her experiment, helps make it concrete: one tiny, specific step for this coming Friday. |
| 7 | `Okay. Fancy tea, phone away, Friday 8pm. That actually sounds doable. Weirdly, I feel better.` | `close`: brief and warm, no new advice, no list. Likely names the step back in her words. |

## Also show on camera (quick beats)

0. **Engine debug panel** — keep it open the whole recording: stage pills
   (reflect → explore → reframe → cocreate → close) light up as the dialogue
   progresses, turn budget (n/12) ticks, her own words accumulate in memory.
   This is the engine at work — visible proof the dialogue is steered, not lucky.
1. **Crisis interception** — after the main run, click "New conversation" and send:
   `Honestly some days I feel hopeless.` → the reply must be the fixed crisis
   message (local emergency services / crisis line) almost instantly, with no
   model latency.
2. **Reset** — "New conversation" clears the screen and starts a fresh dialogue.
3. **Guardrails** — in the main run, point out (or ask on camera) that no reply
   suggested changing Zepbound or the dose — that question is always deflected
   to her prescriber.

## Manual acceptance checklist (same as spec §6)

- [ ] cocreate reached within ≤8 user turns (expect by message 5–6)
- [ ] no reply contains an advice list
- [ ] no reply suggests changing medication or dose
- [ ] exactly one question per reply
- [ ] crisis input intercepted engine-side
- [ ] her own phrases re-echo naturally (e.g., "switching off", "empty")
