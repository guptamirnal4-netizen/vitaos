# Activity-aware posture detection

Posture & Gaze Guard classifies **what you're doing first**, then judges posture
with rules for that situation. A laptop worker, someone on their phone, a person
standing, and someone lying on the sofa each get different checks — and someone
resting gets none.

## Pipeline

```
camera frame
  → MediaPipe Pose (33 body landmarks) + Face (head pitch/roll/yaw, eye closure)
  → features          src/lib/posture/features.ts           normalized geometry, null when not visible
  → activity          src/lib/posture/activityClassifier.ts SITTING | STANDING | LYING_DOWN | POSSIBLE_SLEEP | UNKNOWN | INSUFFICIENT_VISIBILITY
  → device context    src/lib/posture/deviceContext.ts      LAPTOP | PHONE | OTHER | UNKNOWN
  → rule set          src/lib/posture/postureEngine.ts      LAPTOP_SEATED | PHONE | GENERAL_SEATED | STANDING | LYING | none
  → evaluation        src/lib/posture/postureEngine.ts      issues + one recommendation
  → alert validation  src/lib/posture/alertValidator.ts     persistence, cooldown, recovery, resets
  → nudge + wellness  src/lib/camera/usePostureCamera.ts    existing toast / notification / wellness events
```

`src/lib/posture/pipeline.ts` wires the stages; `src/lib/posture/session.ts`
owns the camera lifecycle. Neither touches React, so both are unit-tested
with fakes. All thresholds live in `src/lib/posture/config.ts`.

## Models

- **MediaPipe Pose Landmarker (lite)** and **Face Landmarker**, both from
  `@mediapipe/tasks-vision` 1.0.1 (already a dependency). Apache-2.0 library
  and models, loaded from the same hosts as before (jsDelivr for the WASM
  runtime, Google's model bucket for the weights), which the CSP already allows.
- Loaded once per tab and reused; GPU delegate with CPU fallback.
- Inference runs ~2.5 times per second (`SESSION_CONFIG.INFERENCE_INTERVAL_MS`).

## Activity classification

| State | Evidence |
|---|---|
| SITTING | Thighs near horizontal (hips + knees visible), **or** upper body large in frame with hips out of view — shown as "(estimated)", since a standing desk looks the same |
| STANDING | Thighs near vertical and torso upright |
| LYING_DOWN | Torso (or head→shoulder) axis within 30° of horizontal |
| POSSIBLE_SLEEP | **Dozing in a chair:** sitting with eyes closed ≥ 30 s in a row (a blink resets it). **Resting in bed:** lying down ≥ 3 min **and** nearly still **and** eyes closed ≥ 60 s. Stillness alone never counts; no visible face means no eye evidence. Shown as "Dozing off?" / "Lying down or resting", never as confirmed sleep |
| UNKNOWN | Some body visible but not enough to tell |
| INSUFFICIENT_VISIBILITY | Head and shoulders not visible |

Per-frame estimates go through a confidence-weighted window with hysteresis
(a new state must lead for 2.5 s), and losing sight of the person only counts
after a 2 s grace period.

## Device context

An explicit choice (Laptop / Phone / General) always wins. In **Auto**, the
camera switches context only when ≥ 75 % of ≥ 20 evidence frames agree:
a hand near the face or in front of the chest with the head bent down is phone
evidence; facing the screen with hands down is laptop evidence. Running on a
touch-first device is a weak prior only. A browser can't see which app you're
using or what you're holding, and the UI says so.

## How laptop and phone rules differ

| | Laptop (seated) | Phone |
|---|---|---|
| Head angle down | > 20° (moderate > 32°) | > 32° (moderate > 45°) |
| Forward head (neck height vs. baseline) | < 82 % | < 72 % |
| Shoulders, torso lean | checked | not judged |
| Must persist for | 12 s | 20 s |
| Advice | "…bring the screen closer to eye level" | "…raise your phone closer to eye level" |

Standing uses its own torso/shoulder rules. Lying down only checks a sharply
bent neck (> 40° relative to the torso) — no desk rules.

**Resting / dozing** is never a fault in itself, but a neck left hanging is:
dozing in a chair with the head dropped forward (> 35°) or tipped to one side
(> 25°) for 20 s gets a nudge ("You seem to be dozing with your head tipped to
one side…"). Resting in bed only checks the neck bend. Lying and resting
nudges never count against the posture score.

### Threshold rationale (heuristic, not clinical)

- Screen ergonomics guidance (OSHA computer workstation eTool, ISO 9241-5):
  screen top at or slightly below eye level, comfortable viewing angle about
  15–20° below horizontal.
- Neck load rises steeply with flexion (Hansraj, *Surgical Technology
  International*, 2014); phones are normally viewed lower, so phone rules allow
  more flexion and need it to last longer.
- A front-facing webcam can't see the spine or measure screen height or
  distance. "Forward head" is estimated from the ear-to-shoulder height
  shrinking. **Calibrate** (sit comfortably upright, press *Calibrate*) to
  make it relative to your own posture and camera position.

## Alerts

**Instant alerts (default, Settings → "Alert as soon as my posture isn't
optimal").** Any issue lasting ~3 s triggers a nudge, and an on-screen banner
with the live correction stays on every dashboard page until posture is back
within limits (dismissing it hides it until the next episode). Every new
episode notifies, at most once every 10 s, so a borderline posture can't spam.
Uncorrected issues are re-notified at the "Remind again every" interval, which
is clamped to 1–15 minutes.

**Sustained alerts (instant off):**
Issue persists for the rule's duration → nudge. Still uncorrected → reminder
every "Remind again every" interval (Settings). Back within limits for 2 s →
recovered. The same issue reappearing starts a new episode and still respects
the cooldown. Changing activity or device resets warnings that no longer apply.
Low confidence or no clear view suppresses everything. After 40 min in one
position without moving, a gentle break suggestion. Settings → Alert
sensitivity scales the persistence durations (×1.5 / ×1 / ×0.6).

## Privacy

- Frames are processed in the browser and discarded; nothing visual is stored
  or uploaded. No new data is sent to the server.
- The camera only starts from the Start button. **Stop** (or leaving the
  dashboard) stops every track. **Pause** stops processing but keeps the camera
  on so resuming is instant — the preview badge says so.
- If the model fails to load after the camera opened, the camera is turned off.
- Persisted locally per user: device choice and calibration baseline only.

## Wellness integration

No new score. Persistent warnings log the existing `slouch_detected` event and
recoveries log `posture_alignment_restored`, exactly as the previous detector
did. Lying-down notes and break suggestions log nothing. Session counts
(nudges, corrections, issue types) stay in memory for the Details panel.

## Testing

```bash
npm test          # unit tests, including tests/unit/posture/*
npm run typecheck
npm run lint
```

Unit tests use deterministic synthetic landmarks (`tests/unit/posture/fixtures.ts`)
— no webcam or recordings needed.

### Manual checklist (real webcam)

The automated tests can't use real people (no licensed recordings are bundled),
so check accuracy by hand after changes:

1. Sit upright at a laptop → "Sitting (estimated)", "Posture looks good". Calibrate.
2. Slide forward and drop your head for ~15 s → laptop nudge about screen height / sitting back.
3. Pick **Phone**, look down at a phone held low for ~25 s → phone nudge; brief glances → nothing.
4. Stand back so your legs are visible → "Standing" (not estimated).
5. Lie on a sofa in view → "Lying down", no desk warnings.
5b. Sit back, close your eyes and let your head tip sideways → after ~30 s "Dozing off?", then a dozing nudge ~20 s later.
6. Walk out of frame → "Can't see you clearly", no warning.
7. Pause → badge "Paused — camera still on"; Stop → the browser's camera light turns off.

### Known limitations

- Upper-body-only framing can't distinguish sitting from standing at a desk.
- Lying down is only recognized when the body lies across the camera's view.
- Phone detection from the camera is evidence-based and conservative; when in
  doubt, choose Laptop or Phone yourself.
- In development, MediaPipe's runtime logs `INFO: Created TensorFlow Lite
  XNNPACK delegate` through `console.error`, which the Next.js dev overlay
  counts as an "issue". It is harmless.
