# togetherfit: product direction, V0 scope and decisions

**Prepared:** 19 October 2026 · **Revised:** 19 October 2026: Gym added as a V0 category (see `GYM_ACTIVITY_RESEARCH.md`)
**Code inspected:** `guptamirnal4-netizen/vitaos`, branch `master`, commit `1be0b43` (includes the merged security/auth work and the first activity-aware posture commit)
**Mode:** research and documentation only. No application code, configuration, database or deployment was changed while preparing this document.

This is the single decision document. Every recommendation is stated as a decision, with the reason it was made, including the decisions **not** to build something.

Labels used throughout:
- **[Evidence]**: verified in the code or in a cited source.
- **[Assumption]**: believed but not proven; needs validation.
- **[Recommendation]**: my judgement.

---

## Contents

1. [Executive summary](#1-executive-summary)
2. [Decision register: every decision on one page](#2-decision-register)
3. [Repository audit](#3-repository-audit)
4. [The seven-tab inventory](#4-the-seven-tab-inventory)
5. [What togetherfit should be: product directions compared](#5-what-togetherfit-should-be)
6. [Positioning, target user and metrics](#6-positioning-target-user-and-metrics)
7. [Tab-by-tab evaluation and scoring](#7-tab-by-tab-evaluation-and-scoring)
8. [Connect deep-dive](#8-connect-deep-dive)
9. [Competitor analysis](#9-competitor-analysis)
10. [Exact V0 scope: Must / Should / Later / Excluded](#10-exact-v0-scope)
11. [User journeys and failure cases](#11-user-journeys-and-failure-cases)
12. [Metrics](#12-metrics)
13. [Technical feasibility](#13-technical-feasibility)
14. [Roadmap and acceptance criteria](#14-roadmap-and-acceptance-criteria)
15. [Risks, assumptions and open questions](#15-risks-assumptions-and-open-questions)
16. [Final answer](#16-final-answer)

---

## 1. Executive summary

**Is Connect the right focus for V0?** Yes, but not in the form you proposed.

- **Leading with Connect is right.** It is the only part of togetherfit with network effects, a reason to come back weekly, and a measurable real-world outcome: people actually exercising together. The other five wellness modules each face mature, often free competitors and would not, on their own, give anyone a reason to choose togetherfit.
- **Leading with 5-a-side football and turf booking is wrong.** Playo already offers your proposed flow almost step for step: create an activity, join requests, host approval, co-host, mark as full, group chat, skill ratings, venue booking and split payment ([Playo help: hosting](https://playo.freshdesk.com/support/solutions/articles/1070000107582-how-does-hosting-a-match-work-), [CometChat case study](https://www.cometchat.com/customer-stories/playo)). Hudle, KheloMore and Turf Town cover most of it too. Building a copy of Playo with less supply is not a credible wedge.

**Recommended direction.** togetherfit V0 should be the easiest and safest way for young urban Indians to find a nearby person or small group for a walk, a run or a gym session, and actually show up. It should be built around **host-posted, host-approved activities**, with comfort and safety controls, launched in **one dense community** such as a campus or neighbourhood.

**Why walking and running as the primary categories:**
- No venue booking or payment is needed.
- They are the lowest-barrier, highest-frequency forms of movement.
- The Indian turf-sports apps are built around turfs and booking rather than these activities [Assumption, based on how they present themselves; see §9].
- They fit the existing wellness identity and the trust features already in the code: comfort matching, photos, report and block.

**Gym (added in revision): a secondary V0 category, using the same flow.**
- **Strongest retention traits:** people train 3–5 times a week, and partner exercise is linked to longer persistence in lab studies.
- **Nearly free to add:** it's already a category in the code, needs no venue booking or payment, and fits the shared activity model with two optional fields.
- **Why secondary:** a much smaller partner pool, because partners need access to the *same gym* at the *same time*.
- **Promotion rule:** Gym becomes a primary category if the launch test shows it fills sessions and keeps partners returning at least as well as walking and running. Details: `GYM_ACTIVITY_RESEARCH.md`.

**Biggest technical gap.** Your proposed flow needs a real **Activity** object with slots, approval, status and cancellation. That object does not exist. Today's Connect matches *people* who search at the same time. Groups have no capacity, venue, approval or cancellation. Notifications only reach people while the app is open.

**What V0 is.** Activities with approval, an activity chat, email notifications and attendance confirmation. Everything else is hidden from navigation (code kept, not deleted): the wellness score, Move & Coach, Sanctuary, Posture & Gaze Guard and UrgeSurfer.

**North Star Metric.** Weekly completed group activities: activities that took place, where the host and at least one approved participant confirmed they attended.

---

## 2. Decision register

Each decision gives a ✅ (do it) or ❌ (don't), and why. Details follow in later sections.

### Product direction

| # | Decision | Answer | Why |
|---|---|---|---|
| D1 | Should Connect lead V0? | ✅ **Yes** | It is the only tab with network effects, a weekly reason to return, and an outcome other products can't easily copy: completed sessions with real people. |
| D2 | Should V0 be an all-in-one wellness app (all 7 tabs)? | ❌ **No** | Seven areas split a tiny team across six crowded markets (§9). Nobody can explain the value in one sentence, and none of the non-social tabs is the best in its own category. |
| D3 | Should V0 compete head-on on turf sports (5-a-side football, box cricket)? | ❌ **No** | Playo, Hudle, KheloMore and Turf Town already do this, with venue supply and split payments (§9.1). We would need turf partnerships and payments just to reach parity. |
| D4 | Which activities in V0? | ✅ **Walking and Running (primary) + Gym (secondary, same flow)**; *revised to add Gym* | No venue, no booking, no money changes hands. Low skill barrier. Can happen daily. Matches the wellness positioning. Two categories keep the supply in one city dense enough to work. |
| D5 | Launch everywhere or in one place? | ✅ **One dense community first** (one campus or one neighbourhood) | A marketplace with people spread thinly shows empty lists. The current Connect already needs two people within a radius at the same hour (§3.3). Density beats reach at V0. |
| D6 | Validate before building? | ✅ **Yes, a 2-week manual ("concierge") test runs in parallel with the build** | Demand for walk/run partners is an [Assumption]. Posting 10–15 walks or runs by hand in one community and measuring fill and turn-up costs almost nothing and protects weeks of engineering. |

### Tabs and navigation

| # | Decision | Answer | Why |
|---|---|---|---|
| D7 | Overview (Global Wellness Score) | ❌ **Hide the score in V0.** Turn Home into "your upcoming activities + activities near you" | A self-reported score competes with sensor-driven scores (Ultrahuman, WHOOP, Oura, Samsung) and needs several modules feeding it. Home should drive the core action. |
| D8 | Connect | ✅ **Keep and rebuild around Activities** | Core of V0 (D1). |
| D9 | Move & Coach | ❌ **Hide in V0** (code kept). Let Winter Arc run to its 31 Dec end, but don't extend it. | Crowded category (cult.fit, HealthifyMe, FITTR, Fitbod, Freeletics, Nike Training Club). AI coaching carries advice risk and needs an API key. It doesn't help a host fill a walk. |
| D10 | Sanctuary | ❌ **Hide in V0** | Finch, Fabulous and RISE do habits and circadian guidance better. The bio-room depends on the score being hidden by D7. |
| D11 | Posture & Gaze Guard | ❌ **Remove from V0 navigation, but keep it as a separate experiment candidate** | The most technically distinctive feature, but for a *different user* (desk workers), a *different device* (laptop webcam) and a *different moment* (working, not meeting people). Webcam posture apps already exist (Nekoze, SitApp, StopSlouching). Putting it inside a social app dilutes both. |
| D12 | UrgeSurfer | ❌ **Hide in V0** | Breathing and grounding tools are commodities (Breathwrk, Headspace, Calm, Wysa). It sits near mental health, which brings duty-of-care risk without a clinical partner. |
| D13 | Me (profile, settings) | ✅ **Keep, simplified** | Needed for trust (name, photo, comfort settings), legal and privacy obligations (export/delete account), and authentication. |
| D14 | Seven-item navigation in V0? | ❌ **No: four destinations**: Explore · My Activities · Chats · Me, plus a prominent "+ Create" | Each visible tab competes for the first action. Four destinations leave one obvious thing to do. |
| D15 | Delete the hidden modules' code? | ❌ **No: hide it behind a flag** | Deleting costs work twice if a module returns. Hiding is reversible. Dead code should be removed only once a module is formally abandoned. |

### Connect: what V0 does and doesn't include

| # | Decision | Answer | Why |
|---|---|---|---|
| D16 | Persistent, host-posted Activities with slots | ✅ **Must** | The core missing capability. A listing waits for joiners, so it works with sparse supply. Today's "Now" radar needs both people online at once. |
| D17 | Keep the "Now" radar (live matching) | ❌ **Postpone** | It needs two people searching the same sport, within the radius, in the same hour, both with the app open (heartbeat expiry, §3.3). That is the worst possible cold-start design. Revisit once density exists. |
| D18 | Join by request with host approval | ✅ **Must, on by default** | Safety for meeting strangers, and the host controls who comes. Playtomic and Playo use the same pattern, so users already understand it. |
| D19 | Auto-join ("open" activities) | ✅ **Should, as a host option** | Speeds up filling for trusted hosts. The same data model supports it with one flag. |
| D20 | Venue: manual meeting point via the existing map picker | ✅ **Must** | Walks and runs need a meeting point, not a booking. The area picker and place search already exist. |
| D21 | Venue directory / live turf availability / booking | ❌ **No** | Not needed for walking or running. It's a separate business (supply partnerships), and competitors already own it. |
| D22 | In-app payments or split cost | ❌ **No.** A free-text "cost note" field is enough | Walks and runs are free. Payments add payment regulation, refunds and disputes for no V0 value. |
| D23 | Notifications | ✅ **Must: email + in-app inbox.** Web push is **Should**. | Hosts must hear about requests when the app is closed. Email infrastructure (SES/SMTP) already exists, so it's the cheapest reliable channel. Web push needs extra work and iOS support is limited. |
| D24 | Chat | ✅ **Must: one group chat per activity, unlocked on approval** | Coordination ("I'm at gate 2") is required. The group chat engine already exists and only needs re-pointing at activities. |
| D25 | 1:1 DMs, friend codes | ✅ **Keep existing, but not promoted** | Already built and cheap to keep. DMs keep a pair together after their first activity (repeat participation). |
| D26 | Milestones / celebration cards | ✅ **Keep minimal** (the first-activity milestone only) | Rewards the North Star action and already exists. More milestones come later. |
| D27 | Skill/pace field | ✅ **Must, one simple field**: "easy / moderate / brisk" (walk) or "pace band" (run) | The most common reason people bail on a group run is a pace mismatch [Assumption]. One field avoids a mismatch without a rating system. |
| D28 | Peer skill ratings ("Turf Level", "GRIP"-style) | ❌ **No** | Needs volume to mean anything and invites abuse. |
| D29 | Map-based discovery | ❌ **No: a list sorted by time and distance** | A list is faster to build, works on small screens, and in one community the map adds little. |
| D30 | Show "Verified" badges | ❌ **No, not until a real provider exists** | The verification provider is only `mock` or `off`, and `mock` is the default, which approves everyone (§3.4). A fake badge in a stranger-meetup app is a safety liability. |
| D31 | Comfort matching (women-only / verified-only preferences) | ✅ **Keep, applied to activities** ("Women only" activity setting) | Already built. A credible trust wedge for walk/run meetups [Assumption]. |
| D32 | Exact meeting point visibility | ✅ **Only for approved participants.** Others see the area name and approximate distance. | Prevents strangers turning up uninvited and protects hosts. The area-rounding code already exists. |
| D33 | Attendance confirmation after the activity | ✅ **Must** | The North Star depends on it, and it feeds milestones and trust signals. |
| D34 | Ratings or reviews of people | ❌ **No** | Needs volume and moderation, and invites retaliation. Report and block cover V0 safety. |
| D35 | Native mobile apps | ❌ **No: responsive web app / installable PWA** | One codebase already works on phones. App-store releases slow down learning. |

### Gym (added in revision; full analysis in `GYM_ACTIVITY_RESEARCH.md`)

| # | Decision | Answer | Why |
|---|---|---|---|
| D39 | Include Gym in V0? | ✅ **Yes, as a secondary category (Should Have)** | Highest frequency and repeat potential of any category. It's already in the code, needs no booking or payment, and the shared model covers it. Weakest liquidity (same gym + same time), so it doesn't lead |
| D40 | Make Gym the primary category? | ❌ **Not yet: decide from data** | Category scores: walk 4.10, run 4.10, gym 4.05. The ranking flips if liquidity matters less. The 3-arm launch test decides (promote if fill rate is within 10 points of the best arm *and* gym has the highest repeat-pair rate) |
| D41 | Separate "gym partner" product or flow? | ❌ **No: the same activity flow** | All six gym use cases reduce to "a scheduled session at a named gym" |
| D42 | Public "members at my gym" directory? | ❌ **No** | It reveals where and when someone reliably is (a stalking risk). Instead, a *private* saved gym used only to filter sessions |
| D43 | Gym directory, live availability, gym-software or multi-gym-pass integrations? | ❌ **No** | Manual gym name + map pin is enough. Integrations are partnerships with no proven demand yet |
| D44 | Collect body, health or lift data to match partners? | ❌ **Never in V0** | Not needed to coordinate a session; sensitive personal data |
| D45 | Gym session size | ✅ **2–4 people** | Gyms limit guests; groups of strangers are awkward on a gym floor. Bigger group workouts come later |
| D46 | Recurring gym sessions | 🟡 **V0: "Repeat this session" (invites previous partners first). True recurrence in V1** | Consistency is the gym value. Full recurrence adds scheduling and routine-exposure risk |
| D47 | Positioning for gym matching | ✅ **Explicitly platonic** | Competing gym-buddy apps blend in dating (Gymder, Brocnbells' "date" intent). A safety-first, platonic option is a credible gap in India [Assumption] |

### Operational decisions to make before V0 launch (not code)

| # | Decision | Answer | Why |
|---|---|---|---|
| D36 | Set `VERIFICATION=off` in production now | ✅ | Stops mock "verified" outcomes on the live site (§3.4). |
| D37 | Consolidate the two Vercel projects (`vitaos-jd8j` and `vitaos`) | ✅ | Both deploy from the same repo, but only one has the production variables. The duplicate builds a broken copy on every push. |
| D38 | Keep using Gmail SMTP for email in production | ❌ Move to Amazon SES (already supported in code) before scaling | Gmail sending limits (roughly 500/day per Google's published limits; re-check) and deliverability get worse once notifications are the product. |

---

## 3. Repository audit

### 3.1 Stack and architecture [Evidence]

- **Frontend:** Next.js 16.4, React 19, TypeScript, Tailwind CSS v4, Zustand stores. Icons use an icon registry; a lint rule bans emoji.
- **Backend:** Next.js API routes on PostgreSQL (Neon), with server-side authentication: email + password, email codes (OTP), httpOnly session cookies, rate limits and security headers.
- **Realtime:** chat signals through Ably or Server-Sent Events, falling back to polling.
- **Sync:** wellness, workout and settings data are stored per user and synced to the server (`user_app_state`).
- **Operations:** health check endpoint, client error reporting, a daily cleanup job (`vercel.json`), and Docker self-hosting files.
- **Tests:** Vitest unit tests and API tests against a real Postgres database (see `tests/README.md`).

### 3.2 Navigation [Evidence]

- **Desktop sidebar:** Overview · Connect · Move & Coach · Sanctuary · Posture & Gaze Guard · UrgeSurfer · My Profile · Settings, plus Moderation for admins.
- **Mobile bottom bar:** Home · Connect · Move · Me. "Me" contains the profile, settings and the three wellness modules.
- Source: `src/components/shell/navItems.ts`, `Sidebar.tsx`, `BottomTabBar.tsx`.

### 3.3 Connect: what actually exists [Evidence, from code]

| Capability | Status | Notes |
|---|---|---|
| Find a Friend: area, time, sport, then a radar of matching people | **Working** (database-backed) | Match = same sport, within the searcher's radius (1–50 km), with 60-minute slots overlapping (`findDb.ts`). "Now" searches expire if the app stops sending heartbeats (closed or backgrounded). Scheduled searches can be up to 30 days ahead. |
| Connection request to a person | **Working** | Person-to-person (`connections` table, status pending/accepted/declined/blocked). |
| Groups | **Working, but basic** | Created from the radar. **Join is immediate. No capacity, no host approval, no venue, no notes or cost, no cancellation.** Groups expire 120 minutes after their start time. |
| 1:1 and group chat | **Working** | Realtime, with paginated history and safe retries. |
| Friend codes | **Working** | Add a friend by code. |
| Milestones and celebration cards | **Working** | Built from `activity_sessions`. Sessions are self-logged ("we did it"), with no confirmation by the other person. |
| Report, block, restrictions | **Working** | Reports have categories, an admin moderation page, and an escalating restriction system. |
| Profile photo, gender, comfort matching | **Working** | Comfort matching is mutual (women-only / men-only / anyone, verified-only). |
| Selfie verification | **Placeholder** | Only providers are `off` and `mock` (`src/lib/trust`). See §3.4. |
| Notifications | **In-app only** | Polling (20 s, or 120 s when realtime is live) and in-app toasts. **No push. No email for social events.** Email is only sent for authentication and account changes. |
| Gym as a category | **Exists as a sport key** | `gym` is in `src/lib/connect/sports.ts`; `/move` has a "Find Gym Partner" button; the workout player logs a `gym` session for milestones (`gym_session_completed` event) |
| Activity object (slots, approval, status, cancellation) | **Does not exist** | The schema comment on `connections.activity_id` says "references activities(id) once Milestone 2 adds that table". |

### 3.4 Problems found during the audit (not fixed, research only)

1. **Verification can approve everyone.** `trustProvider()` defaults to `mock` when `VERIFICATION` isn't set. The mock passes unless `MOCK_VERIFICATION_OUTCOME` says otherwise, and the code itself warns *"verification badges are not real"* in production. I did not check whether `VERIFICATION` is set in production; it wasn't among the variables we configured together. → D30, D36.
2. **Two Vercel projects deploy the same repository** (`vitaos-jd8j` is the live one, `vitaos` is a duplicate with no environment variables). → D37.
3. **The "Now" radar needs both people online at the same time.** That's the main structural cold-start problem. → D17.
4. **Joint sessions are self-reported by one person.** Milestones can be earned without the other person confirming. → D33.
5. **The production branch lags the posture work.** `master` has the first posture commit; two later posture commits (dozing detection, instant alerts) sit on `feat/activity-aware-posture` and are not merged. This only matters if Posture stays visible.

---

## 4. The seven-tab inventory

### 4.1 Overview (`/`)

| Feature | Problem it solves | User | Status | Complexity | Needed for V0 journey? | Decision |
|---|---|---|---|---|---|---|
| Global Wellness Score (5 dimensions, resets daily) | "How balanced was my day?" | Self-trackers | Working, local + synced. Driven by events from other modules (`docs/wellness-score.md`) | Medium (depends on 5 modules) | No | **Hide** (D7) |
| Module overview cards, quick actions, recommendations | Navigate to modules | All | Working | Low | No | **Replace** with upcoming/nearby activities |
| Wellness trend chart, ecosystem map, Activity Explorer | Show history and links between modules | Self-trackers | Working | Low | No | **Hide** |

### 4.2 Connect (`/connect`)

| Feature | Problem | User | Status | Complexity | V0 journey? | Decision |
|---|---|---|---|---|---|---|
| Find a Friend (scheduled) | Find someone to exercise with at a set time | Anyone wanting company | Working | High | Partly. Its matching ideas and area picker are reused | **Evolve into Activities** (D16) |
| Find a Friend (Now) | Find someone right now | Spontaneous users | Working | High | No | **Postpone** (D17) |
| Groups + group chat | Coordinate several people | Groups | Working, but basic | Medium | Yes, as activity chat | **Reuse** for activity chat (D24) |
| 1:1 messages, friends, codes | Stay in touch | Pairs | Working | Low | Supporting | **Keep, not promoted** (D25) |
| Milestones / celebration | Reward showing up together | All | Working | Low | Supporting | **Keep minimal** (D26) |
| Safety: report, block, restrictions, comfort matching | Trust when meeting strangers | All, especially women | Working | Medium | **Yes** | **Keep** (D31) |
| Verification | Prove you're a real person | All | Mock only | High (needs a vendor) | Would help, but can't be faked | **Hide badges** (D30) |

### 4.3 Move & Coach (`/move`)

| Feature | Problem | User | Status | Complexity | V0? | Decision |
|---|---|---|---|---|---|---|
| Goals | Set fitness targets | Self-directed exercisers | Working (local + sync) | Low | No | Hide |
| AI Coach | Get a workout suggestion | Beginners | Working. Groq → Ollama → rules fallback; crisis messages get a fixed answer | Medium (API key, advice risk) | No | Hide |
| Workout builder + set-by-set player | Do a structured workout | Gym and home users | Working | Medium | No | Hide |
| Exercise library (27 exercises, photos, Do/Don't lists) | Learn form | Beginners | Working. Photo licences aren't recorded in the repo | Low | No | Hide. **Resolve photo licensing before re-enabling** |
| Progress | See history | Self-trackers | Working | Low | No | Hide |
| 15-minute walk timer | Take a short walk | Desk workers | Working | Low | No (V0 walks are social) | Hide |
| Winter Arc event (1 Oct–31 Dec) + admin stats | Seasonal motivation | Existing users | Working, live | Low | No | **Let it finish, don't extend** (D9) |

### 4.4 Sanctuary (`/sanctuary`, `/sanctuary/circadian`)

| Feature | Problem | User | Status | Complexity | V0? | Decision |
|---|---|---|---|---|---|---|
| Bio-room visual | Motivation through a living visual | Habit builders | Working; depends on the score | Low | No | Hide |
| Daily habits (water, stretching, sunlight, digital wellness) | Track small habits | Habit builders | Working | Low | No | Hide |
| Circadian Arc (morning light, wind-down, sleep window) | Better sleep timing | Poor sleepers | Working (manual logging) | Low | No | Hide |

### 4.5 Posture & Gaze Guard (`/posture`)

| Feature | Problem | User | Status | Complexity | V0? | Decision |
|---|---|---|---|---|---|---|
| On-device webcam detection (MediaPipe Face + Pose), activity-aware rules, calibration, nudges, privacy controls | Neck and back strain at a screen | Desk and laptop workers, students | Working; 102+ unit tests; not yet validated on real people | High (already paid for) | No | **Remove from V0 nav; candidate for a separate experiment** (D11) |

### 4.6 UrgeSurfer (`/urgesurfer`)

| Feature | Problem | User | Status | Complexity | V0? | Decision |
|---|---|---|---|---|---|---|
| Custom breathing engine, presets, saved patterns | Calm down quickly | Stressed users | Working | Low | No | Hide |
| Rhythm tap reset | Interrupt an urge | Users with cravings | Working | Low | No | Hide |
| 5-4-3-2-1 grounding | Anxiety grounding | Anxious users | Working | Low | No | Hide |
| Urge scale, history, completion | Track resets | Same | Working | Low | No | Hide |

### 4.7 Me (`/personal`, `/profile`, `/settings`)

| Feature | Problem | User | Status | Complexity | V0? | Decision |
|---|---|---|---|---|---|---|
| Profile (name, photo, gender, comfort, photo-on-radar) | Trust and identity | All | Working | Low | **Yes** | **Keep** |
| Settings (theme, alerts, notifications) | Preferences | All | Working | Low | Yes (notification settings) | Keep, but cut posture/gaze settings |
| Account: email change, password, export, delete | Account control and data rights | All | Working | Low | **Yes** (legal/privacy) | **Keep** |
| Moderation (admin) | Handle reports | Admins | Working | Medium | **Yes** (safety) | **Keep** |

---

## 5. What togetherfit should be

### 5.1 Directions compared

Scores are 1–5 (5 = best). "Cost" and "cold start" are scored so that 5 = cheapest or easiest.

| Criterion | A. Social activity coordination | B. Wellness accountability | C. Personal fitness | D. All-in-one wellness | **E. Safe walk/run meetups (a narrow A)** |
|---|---|---|---|---|---|
| Strength of user problem | 4 | 3 | 3 | 2 | **4** |
| How often the problem occurs | 3 (weekly games) | 4 | 4 | 4 | **4** (several times a week) |
| Likelihood of repeat use | 4 | 3 | 3 | 2 | **4** |
| Easy to explain | 4 | 3 | 5 | 1 | **5** |
| Differentiated from what exists | 1 (Playo et al.) | 2 | 1 | 2 | **3** [Assumption] |
| MVP cost | 2 (turfs, payments) | 3 | 4 (mostly built) | 4 (built) | **3** |
| Time to the first real outcome | 3 | 2 | 5 | 3 | **4** |
| Network effects | 5 | 2 | 1 | 1 | **4** |
| Cold start | 1 | 4 | 5 | 5 | **2** (mitigated by D5) |
| Retention potential | 4 | 3 | 2 | 2 | **4** |
| Future monetisation | 4 (bookings) | 2 | 3 | 2 | **3** (premium hosting, clubs, brand partnerships) |
| **Average** | 3.2 | 2.8 | 3.3 | 2.5 | **3.6** |

### 5.2 Why the other directions lose

- **A, broad sports coordination (your football example):** has the strongest network effects, but the worst differentiation. Incumbents already have venue supply and payments (§9.1). Reaching parity means building a booking marketplace first.
- **B, wellness accountability (habits, streaks):** cheap and frequent, but solo accountability is a weak driver of retention. Finch, Fabulous and Habitica already own it.
- **C, personal fitness:** mostly built and quick to deliver value. It is also the most crowded category in India (cult.fit, HealthifyMe, FITTR) and globally, with no network effect.
- **D, all-in-one wellness:** what the app is today. It can't be explained in one sentence, every tab is second-best in its category, and engineering effort gets spread thin. Rejected (D2).
- **E (chosen):** keeps A's network effects, sidesteps the incumbents' turf and booking strength, keeps V0 cheap (no venues, no payments), and reuses the trust features togetherfit already has.

---

## 6. Positioning, target user and metrics

**Positioning statement [Recommendation]**
> For young urban Indians who want to move more but find it hard to stay consistent alone, togetherfit helps them actually show up for a walk, run or gym session with nearby people, through host-approved, comfort-matched meetups that need no booking or payment, unlike turf-booking sports apps built around paid games or fitness apps that leave you exercising alone.

- **Primary target user [Assumption, to validate]:** students and young working adults (about 18–30) in one dense area (campus, residential cluster). They want company for walks or runs, and many care about safety when meeting strangers (especially women).
- **Secondary user:** regular runners or walkers who'd host a recurring group (the supply side). Hosts matter more than joiners early on.
- **Secondary user (revision):** gym-goers who already have access to a gym (campus, society, commercial or multi-gym pass) and train irregularly. They're the most likely to *repeat* with the same partner [Assumption].
- **Core user problem:** "I mean to walk, run or hit the gym, but alone I skip it, and I don't know anyone nearby who goes at my time and pace whom I'd feel safe meeting."
- **Main value proposition:** a safe, nearby person to move with, at your time and pace, confirmed before you leave home.
- **Primary use case:** "Morning walk tomorrow, 6:30, near the north gate, easy pace, 3 spots, women only."
- **Single action that shows value ("aha"):** attending your first completed activity with someone new.
- **North Star Metric:** weekly completed group activities (defined in §12).
- **Supporting metrics:** fill rate, time to fill, join-request conversion, 30-day repeat participation, host return rate (definitions in §12).

---

## 7. Tab-by-tab evaluation and scoring

### 7.1 Per-tab analysis

| Field | Overview | Connect | Move & Coach | Sanctuary | Posture & Gaze | UrgeSurfer | Me |
|---|---|---|---|---|---|---|---|
| Current purpose | Wellness score, links to modules | Find people, chat, groups, milestones | Goals, AI coach, workouts, library, Winter Arc | Bio-room, habits, circadian | Webcam posture nudges | Breathing, rhythm, grounding | Profile, settings, account |
| User problem | "How am I doing overall?" | "No one to move with" | "What workout should I do?" | "Build small habits" | "Neck and back strain at a desk" | "Interrupt an urge or stress" | Identity, trust, control |
| Primary user | Self-trackers | People wanting company | Gym and home exercisers | Habit builders | Desk workers | Stressed users | Everyone |
| Usage frequency | Daily if the score matters | Several times a week | 3–4 times a week | Daily | Daily during work | Occasional | Occasional |
| Core value | Overview | **Real sessions with people** | Guidance | Motivation | Ergonomics | Calm | Trust |
| Competitors (§9) | 4 found | 16 found | 6 found | 6 found | 6 found | 7 found | not researched |
| Competitive overlap | High (wearables) | High for turf sports; lower for walk/run [Assumption] | Very high | High | High (commodity) | Very high | n/a |
| Possible differentiation | A score with no wearable needed | Safety, comfort matching, walk/run focus | Weak | Weak | Eye level + activity awareness (not verified elsewhere) | Rhythm tap (not verified elsewhere) | n/a |
| Dependencies | All modules | Auth, Me, notifications | Score | Score | Camera, models | None | Auth |
| Complexity | Medium | High | Medium | Low | High (done) | Low | Low |
| V0 decision | Hide score; repurpose Home | **Keep, rebuild** | Hide | Hide | Remove from nav; separate experiment | Hide | Keep, simplify |
| Success metric (if kept) | n/a | Weekly completed activities | n/a | n/a | n/a | n/a | Profile completion; reports handled |

### 7.2 Scoring model

**Criteria and weights**
- User value 30%.
- Importance to the core product 30%.
- Frequency 15%.
- Differentiation 10%.
- Ease of implementation 7.5% (5 = low effort).
- Low risk 7.5% (5 = low technical or operational risk).

**Formula:** `Score = 0.30·Value + 0.30·Core + 0.15·Frequency + 0.10·Differentiation + 0.075·Ease + 0.075·LowRisk`

**Assumptions:**
- "Core" is scored against direction E.
- "Ease" counts the work still needed for V0, not work already done.
- Scores are my judgement, informed by §3 and §9.

| Tab | Value | Core | Freq | Diff | Ease | Low risk | **Weighted** | Rank |
|---|---|---|---|---|---|---|---|---|
| Connect | 5 | 5 | 4 | 3 | 2 | 2 | **4.20** | 1 |
| Me | 3 | 4 | 2 | 1 | 4 | 4 | **3.10** | 2 |
| Posture & Gaze | 3 | 1 | 4 | 3 | 4 | 3 | **2.63** | 3 |
| Move & Coach | 3 | 2 | 3 | 1 | 3 | 3 | **2.50** | 4 |
| Overview | 2 | 2 | 3 | 2 | 4 | 3 | **2.38** | 5 |
| UrgeSurfer | 3 | 1 | 2 | 2 | 5 | 3 | **2.30** | 6 |
| Sanctuary | 2 | 1 | 3 | 2 | 4 | 4 | **2.15** | 7 |

*Revision note (Gym):* adding Gym inside Connect raises its expected frequency (gym partners meet several times a week). The Connect score would move from 4.20 to 4.35 if Frequency is rated 5. Its rank doesn't change, so the table is kept as published.

**How to read this:**
- **Connect and Me are kept,** and the scores agree.
- **Posture ranks third, ahead of Move,** because it is already built, used often and somewhat distinctive. Its "Core" score is 1 because it serves a different user at a different moment. That's why the decision is "separate experiment", not "keep in V0". The score informs the decision but doesn't override judgement.

### 7.3 Final decision table

| Tab | V0 decision | V0 functionality | Deferred functionality | Reason |
|---|---|---|---|---|
| Overview | **Simplify / repurpose** | Home = my upcoming activities + activities near me | Wellness score, trend chart, ecosystem map, Activity Explorer | Home should lead to the core action; the score needs the hidden modules |
| Connect | **Keep (lead)** | Activities: create, browse, request, approve, chat, attend, cancel; safety; friends/DMs | "Now" radar, map discovery, payments, venue booking, peer ratings | The core journey (D1, D16–D35) |
| Move & Coach | **Postpone** | none (Winter Arc runs out) | Everything | Crowded; not on the core journey |
| Sanctuary | **Postpone** | none | Everything | Crowded; depends on the score |
| Posture & Gaze | **Remove from V0 nav; separate experiment** | none in the V0 app | Whole module, possibly as a standalone product | Different user, device and moment |
| UrgeSurfer | **Postpone** | none | Everything | Crowded; near mental-health care |
| Me | **Keep, simplify** | Profile, comfort settings, notification settings, account controls, moderation | Posture/gaze settings, wellness setup | Trust and data-rights requirements |

### 7.4 Navigation recommendation (not implemented)

- **Mobile bottom bar:** **Explore** (activities near me) · **My Activities** (hosting and joined) · **Chats** · **Me**, with a floating **+ Create** button.
- **Desktop:** the same four in the sidebar.
- **Why:** four destinations means one obvious first action (find or create). The hidden modules stay reachable through a feature flag for internal testing.

---

## 8. Connect deep-dive

### 8.1 Is your proposed 15-step flow right? Step by step

| Step (your proposal) | V0? | Decision and simplification |
|---|---|---|
| 1. Choose category | **Must** | Walking, Running (primary) and Gym (secondary) (D4, D39) |
| 2. Choose format (5-a-side, …) | **Simplify** | Replaced by one pace/intensity field (D27); for Gym, one session-type field (strength / cardio / general) |
| 3. Date and time | **Must** | Up to 14 days ahead (shorter than the current 30, to keep listings fresh) [Recommendation] |
| 4. Location / turf | **Must (simplified)** | Meeting point via the existing map picker and place search; no turfs (D20, D21) |
| 5. Number of participants | **Must** | Capacity 2–10 (one host + 1–9) [Recommendation] |
| 6. Participant criteria | **Must (minimal)** | Pace + "women only" (comfort matching, D31) |
| 7. Notes and cost sharing | **Must (notes)**; cost as free text | No payments (D22) |
| 8. Publish | **Must** | |
| 9. Others discover and view details | **Must** | List sorted by start time and distance; area shown, exact point hidden (D29, D32) |
| 10. Request to join / join directly | **Must**: request + approval by default; **Should**: open join | D18, D19 |
| 11. Notify host | **Must**: email + in-app | D23 |
| 12. Host accepts or rejects | **Must** | |
| 13. Notify participant | **Must** | |
| 14. Confirmed participants, slots, status | **Must** | |
| 15. Cancellations, withdrawals, notifications | **Must** | No-shows are the main way meetups fail [Assumption] |
| *(added)* Attendance confirmation | **Must** | Needed for the North Star and trust (D33) |
| *(added)* Reminder before start | **Should** | Cuts no-shows; needs a scheduled job (§13) |

### 8.2 Reusable activity data model [Recommendation]

One common shape, with a small optional field set per category. No separate flows per sport.

```
activities
  id, host_id, category ('walk' | 'run' | 'gym'), title (optional)
  starts_at, duration_min
  area_label, area_lat/lng (rounded, public), meeting_point_label, meeting_lat/lng (exact, approved only)
  capacity (2–10), join_mode ('approval' | 'open'), women_only (bool)
  intensity ('easy' | 'moderate' | 'brisk')       -- walk
  pace_band ('<5:30' | '5:30–6:30' | '6:30–7:30' | '>7:30' min/km), distance_km  -- run (optional)
  session_type ('strength' | 'cardio' | 'general'), experience_level (optional)    -- gym; meeting_point_label = gym name
  notes, cost_note (free text)
  status ('open' | 'full' | 'cancelled' | 'completed' | 'expired')
  group_id (activity chat; reuse groups)
  created_at, cancelled_at, cancel_reason

activity_participants
  activity_id, user_id, status ('requested' | 'approved' | 'declined' | 'withdrawn' | 'removed')
  attended (null | true | false), requested_at, decided_at
  unique (activity_id, user_id)

notifications
  id, user_id, type, activity_id, payload, created_at, read_at, emailed_at
```

**Gym** uses the same flow, with capacity 2–4 and a *private* saved "my gym" per user (used only to filter sessions, never shown). Full field list: `GYM_ACTIVITY_RESEARCH.md` §8.

**Later categories** (cycling, yoga, badminton, football) can be added by:
- adding a category value;
- adding one or two optional fields (format for football, singles/doubles for badminton);
- using the same flow. Bookings and payments are only considered when a category requires a venue.

### 8.3 Booking vs. coordination

| Option | V0? | Why |
|---|---|---|
| Manual venue / meeting-point entry | ✅ **Yes** | Enough for walk/run. Already supported by the map picker. |
| Curated list of venues | Later | Useful for parks or running tracks in the launch community; a plain list, maintained by hand. |
| Venue directory integration | ❌ | Partnerships and data-maintenance cost. |
| Live availability and booking | ❌ | A separate marketplace business, owned by Playo, Hudle and KheloMore (§9.1). |

### 8.4 Connect minimum functionality

| Capability | Launch requirement | Note |
|---|---|---|
| Activity discovery (list) | **Required** | Filter: category, date, pace, women-only |
| Create activity | **Required** | |
| Join / request to join | **Required** | |
| Host approval | **Required** | |
| Activity details | **Required** | Area only until approved |
| Participants list + slots left | **Required** | First names + photos for approved participants |
| Notifications | **Required** (email + in-app) | Web push is Should |
| Status + cancellation + withdrawal | **Required** | |
| Basic profile | **Required** | Name, photo, short bio (optional) |
| Report and block | **Required** | Already built; must be added to activity screens |
| Location privacy | **Required** | D32 |
| Chat after acceptance | **Required** | Reuse groups |
| Search / filters | **Required (simple)** | No text search in V0 |
| Empty and error states | **Required** | "No walks near you yet — host the first one" is the cold-start lever |
| Reminders | **Should** | |
| Recurring activities ("every Tue/Thu") | **Should** | High value for hosts; can be "duplicate activity" in V0 |
| Map view | Later | D29 |
| Ratings, payments, bookings | No | D22, D28, D34 |
| Can be simulated in the concierge test | Notifications (manual WhatsApp), approval (host replies), attendance (host confirms by message) | Lets demand be tested before code (D6) |

---

## 9. Competitor analysis

**Method.** Web searches on 19 Oct 2026, preferring official sites, app-store listings and help centres, then reputable press. Claims come from search-indexed page text; not every live page was opened. Self-reported user numbers are noted as such, not verified.

**Counting rule.** Unique products. The figures are *verified relevant competitors identified in this research*, not the size of the whole market.

### 9.1 Connect: 8 direct + 8 adjacent = 16

| Competitor | Type | Relevant capabilities (verified) | Market | Pricing | Gap / opportunity | Source |
|---|---|---|---|---|---|---|
| Playo | Direct | Create activity, join requests, host approval, co-host, mark full, group chat (lasts 7 days after), skill ratings, venue booking, split pay | India | Free app; revenue model unverified | Built around sports and turfs; walk/run and wellness framing look secondary [Assumption] | [Hosting](https://playo.freshdesk.com/support/solutions/articles/1070000107582-how-does-hosting-a-match-work-), [Who can join](https://playo.zendesk.com/hc/en-us/articles/6979801867545-Who-can-join), [Chat](https://www.cometchat.com/customer-stories/playo), [Ratings](https://blog.playo.co/playo-user-rating-graph/), [Play](https://play.google.com/store/apps/details?id=com.techmash.playo&hl=en_IN) |
| Hudle | Direct | Create game (sport, location, skill, max players), pickup games, leagues, Squads, venue booking, split pay, chat | India | Unverified | Same as Playo. Host approval not verified | [Play](https://play.google.com/store/apps/details?id=com.hudle.consumer.app&hl=en_IN), [HudlePlay](https://hudle.in/pages/hudle-play), [Split pay](https://www.facebook.com/hudleindia/videos/hudle-split-payments/363310657635982/) |
| KheloMore | Direct | Host/join games, Circle, skill matching, venue and coaching booking, split pay (some venues) | India | Unverified | Started as venue and academy booking | [Site](https://www.khelomore.com/), [FAQ](https://pages.khelomore.com/public/faq.html) |
| Turf Town | Direct | Host games for others, venue booking, pay your share upfront, chat, clubs, "Turf Level" | India (turf sports) | Unverified | Turf sports only | [App Store](https://apps.apple.com/app/id1490231308) |
| Playtomic | Direct (racquet sports) | Open matches, request a spot (players accept), levels 0–7, split pay, court booking, chat | Global (Europe) | Booking-based | A reference design for request-to-join | [Request spot](https://playerhelp.playtomic.com/hc/en-gb/articles/19832027031569-How-to-request-a-spot-in-a-open-match), [Split](https://playerhelp.playtomic.com/hc/en-gb/articles/19832089052561) |
| OpenSports | Direct (organisers) | Pickup events, RSVP caps, auto-waitlist and refunds, payments | Global (N. America) | Organiser subscription (≈$20–500/mo per GetApp) | Organiser tooling, not peer-to-peer | [GetApp](https://www.getapp.co.uk/software/2053272/opensports) |
| Plei | Direct | Join pickup soccer; pay per game; no charge if the game doesn't confirm | US | $5–11/game (press) | Reference for a minimum-players rule | [Refresh Miami](https://refreshmiami.com/news/plei-is-building-the-worlds-largest-pickup-soccer-app-one-game-at-a-time/) |
| Footy Addicts | Direct | Search and join 5- to 10-a-side games; organiser collects payment | UK | ≈£5–7/game seen | Reference for casual football | [Blog](https://blog.footyaddicts.com/what-is-footy-addicts/) |
| Cult.fit | Adjacent | Classes and gym membership; running clubs and community events (press) | India | Membership (tiers unverified) | Community is tied to the brand and paid membership [Assumption] | [FPJ](https://www.freepressjournal.in/amp/brandsutra/why-cult-invests-in-micro-cultures-beyond-fitness) |
| Strava | Adjacent | Club events: create, RSVP, route, notifications | Global | Freemium | Club-centric; no verified stranger-approval flow [Assumption; source is 2017] | [9to5Google](https://9to5google.com/2017/04/18/strava-club-events/) |
| Meetup | Adjacent | Events, RSVP limits, waitlists | Global | Organiser subscription (current price unverified) | Generic events | [Waitlist](https://help.meetup.com/hc/en-us/articles/41229648295181-How-to-Join-an-Event-Waitlist-on-Meetup) |
| Heylo | Adjacent | Groups, RSVPs, capacity and waitlist, chat, payments, reminders | Global (run clubs) | $0 / $9 / $29 per month + 3.7% + $0.59 payment fee | Organiser tools, not discovery | [Pricing](https://heylo.com/pricing), [Fees](https://heylo.com/help/platform-and-processing-fees) |
| Spond | Adjacent | Team events, availability, payments, messaging | Global (Europe/UK) | Free + payment fees | Fixed teams, not strangers | [Features](https://help.spond.com/en/articles/28547-spond-features-overview) |
| TeamSnap | Adjacent | Scheduling, RSVP, chat, payments | Global (US youth sports) | Free; Premium $10/mo, Ultra $12.50/mo annual (Capterra) | Fixed teams | [Capterra](https://www.capterra.com/p/123208/TeamSnap/) |
| Bumble For Friends | Adjacent | Public/private "Plans" up to 15 people, groups, chat | Global | Freemium | Social, not activity-specific | [Nasdaq PR](https://www.nasdaq.com/press-release/bumble-for-friends-adds-plans-and-ai-powered-conversation-starters-to-make-it-easier) |
| Timeleft | Adjacent | Matched dinners with strangers; weekly runs | Global (India presence unverified) | Paid tickets | Shows demand for meeting strangers offline | [Tasting Table](https://www.tastingtable.com/1859085/dinner-parties-with-strangers-timeleft) |

**Feature comparison: your proposed flow vs. the Indian incumbents**

| Capability | Playo | Hudle | KheloMore | togetherfit today | togetherfit V0 (recommended) |
|---|---|---|---|---|---|
| Create activity with slots | ✅ | ✅ | ✅ | ❌ (people search only) | ✅ |
| Join requests + host approval | ✅ | unverified | unverified | ⚠️ person-to-person only | ✅ |
| Group coordination / chat | ✅ | ✅ (details unverified) | ✅ (type unverified) | ✅ (groups) | ✅ per activity |
| Venue selection | ✅ booking | ✅ booking | ✅ booking | ✅ map pin only | ✅ meeting point |
| Notifications outside the app | likely (native apps, unverified) | likely (unverified) | likely (unverified) | ❌ | ✅ email (push later) |
| Payments / split cost | ✅ | ✅ | ✅ (some venues) | ❌ | ❌ by choice |
| Skill matching | ✅ ratings | ✅ | ✅ | ❌ | ✅ pace field |
| Comfort / women-only matching | not found | not found | not found | ✅ | ✅ |
| Community | ✅ | ✅ Squads | ✅ Circle | ✅ friends | ✅ friends + repeat partners |

**Conclusion.** The basic "host a game, others request, host approves" problem is already well served for turf sports. A wedge that holds up is **walking and running + safety and comfort controls + no booking needed**, launched densely. Whether Playo or Hudle already serve walking and running well, and whether women-only options exist there, **was not fully verified**. Check this hands-on before launch (§15).

### 9.2 Overview (wellness score): 4 direct + 0 adjacent = 4

| Competitor | Type | Capabilities | Market | Pricing | Gap | Source |
|---|---|---|---|---|---|---|
| Ultrahuman Ring AIR | Direct | Recovery Score, Movement Index, Sleep Index, circadian timing | India-founded, global | Ring purchase, no required subscription (retail price via trackers) | Needs hardware | [GSMArena](https://www.gsmarena.com/ultrahuman_ring_air_review-news-62945.php), [Sacra](https://sacra.com/c/ultrahuman) |
| WHOOP | Direct | Strain, Recovery, Sleep, coaching | Global | ≈$199–359/yr (third-party summary) | Strap + subscription | [runnerspicks](https://www.runnerspicks.com/blog/whoop-pricing-2026-membership-explained/) |
| Oura | Direct | Readiness (7 contributors), Activity score | Global | Unverified | Hardware | [Oura](https://ouraring.com/readiness-score) |
| Samsung Health (Energy Score) | Direct | Score from sleep, activity, HR, HRV | Global incl. India | Free app; needs Galaxy hardware | Device lock-in | [Samsung](https://www.samsung.com/us/samsung-health/) |

### 9.3 Move & Coach: 5 direct + 1 adjacent = 6

| Competitor | Type | Capabilities | Market | Pricing | Gap | Source |
|---|---|---|---|---|---|---|
| cult.fit | Direct | Home workouts, AI Trainer "Smart Workout Plan", cultpass gyms and classes | India | Membership (unverified) | Gym-centric | [App Store](https://apps.apple.com/app/id1217794588), [Impact](https://www.impactonnet.com/amp/spotlight/cultfits-ai-powered-workout-to-keep-customers-fit-7734.html) |
| HealthifyMe | Direct | AI coach "Ria" (nutrition, workouts, sleep, stress), human coaches | India + N. America | Subscription (unverified) | Nutrition-led | [HealthifyMe](https://www.healthifyme.com/app) |
| FITTR | Direct | Custom plans, 1:1 coaching, community | India + abroad | Freemium + paid coaching | Paid human coaching | [BioSpectrum](https://biospectrumindia.com/features/85/21051/startupoftheday-145-fittr.html) |
| Fitbod | Direct | AI workout generator, progressive overload | Global | $15.99/mo or $95.99/yr (Fitbod blog) | Gym/strength focus | [Fitbod](https://fitbod.me/blog/best-ai-fitness-apps-2026-the-complete-guide-to-ai-powered-muscle-building-apps/) |
| Freeletics | Direct | AI Coach, Training Journeys, 700+ exercises | Global | Subscription (unverified) | No social layer | [Freeletics](https://www.freeletics.com/en/blog/posts/update-freeletics-training-journeys/) |
| Nike Training Club | Adjacent | Free workouts and programmes | Global | Free | The benchmark for free content | [App Store](https://apps.apple.com/us/app/-/id301521403) |

### 9.4 Sanctuary: 3 direct + 3 adjacent = 6

| Competitor | Type | Capabilities | Market | Pricing | Gap | Source |
|---|---|---|---|---|---|---|
| Finch | Direct | Pet grows with self-care goals, mood, breathing | Global | Free + Plus | The closest to the bio-room idea | [Internet Matters](https://www.internetmatters.org/advice/apps-and-platforms/wellbeing/finch/) |
| Fabulous | Direct | Routines, habit stacking, coaching | Global | Freemium | No circadian timing | [App Store](https://apps.apple.com/US/app/id1203637303) |
| RISE | Direct | Sleep debt, energy peaks and dips, timing advice | Global | Unverified | Sleep-only | [RISE](https://risescience.com/blog/app-sleep-science-become-morning-person) |
| Habitica | Adjacent | RPG habits and dailies | Global | Free + in-app purchases | Generic | [App Store](https://apps.apple.com/gb/app/id994882113) |
| Timeshifter | Adjacent | Circadian light plans | Global | First plan free | Travel-focused | [App Store](https://apps.apple.com/us/app/timeshifter/id1380684374) |
| GOQii | Adjacent | Band + habit tracking + coaches | India | Coaching subscription | Hardware + coach model | [Wikipedia](https://en.wikipedia.org/wiki/GOQii) |

### 9.5 Posture & Gaze Guard: 4 direct + 2 adjacent = 6

| Competitor | Type | Capabilities | Market | Pricing | Gap | Source |
|---|---|---|---|---|---|---|
| Nekoze | Direct | Mac webcam slouch alerts, no data collected | Global (Mac) | Free | Mac only, no eye level | [App Store](https://apps.apple.com/us/app/nekoze/id627505674?mt=12) |
| SitApp | Direct | On-device webcam AI (Mac/Win/Linux), learns your posture, alerts, breaks | Global | Free 60 min/day; Premium from $3.99/mo (Capterra) | Desktop install | [App Store](https://apps.apple.com/us/app/sitapp-posture-reminder/id6768987893?mt=12), [Capterra](https://www.capterra.com/p/10049908/SitApp/) |
| StopSlouching | Direct | Calibrated webcam posture; Windows + Chrome/Edge web app | Global | Unverified | The closest browser competitor | [AlternativeTo](https://alternativeto.net/software/stopslouching/about/) (secondary source) |
| PostureCorrector (extension) | Direct | In-browser slouch detection, desktop notifications | Global | Unverified | Extension only | [ExtensionAuditor](https://extensionauditor.com/scan/posturecorrector-posture-assistance-app-glbckpboobaemcfljiijgndjlkcokppi) (secondary) |
| Posture Pal | Adjacent | AirPods neck-tilt alerts | Global (Apple) | Free with limits | Needs AirPods | [App Store](https://apps.apple.com/us/app/-/id1590316152) |
| UPRIGHT GO 2 | Adjacent | Wearable vibrates when you slouch | Global | Hardware | Device purchase | [TechRadar](https://www.techradar.com/reviews/upright-go-2) |

### 9.6 UrgeSurfer: 2 direct + 5 adjacent = 7

| Competitor | Type | Capabilities | Market | Pricing | Gap | Source |
|---|---|---|---|---|---|---|
| Wysa | Direct (in part) | AI CBT chat, 150+ tools incl. breathing and grounding, Hindi version | India-founded, global | Free chat; paid coaching | Conversation-first | [Inc42](https://inc42.com/buzz/exclusive-google-backs-mental-health-startup-wysa-in-series-a-round/) |
| Breathwrk | Direct (breathing) | Box, 4-7-8, coherent breathing | Global | Free + Pro | No grounding | [App Store](https://apps.apple.com/us/app/-/id1481804500) |
| QuitSure | Adjacent | Smoking-cessation programme | India | Unverified | Smoking only | [JMIR Formative](https://formative.jmir.org/2023/1/e51658) |
| one sec | Adjacent | Breathing pause before opening chosen apps | Global | Free for one app | Phone urges only | [one sec study](https://one-sec.app/max-planck-study) |
| I Am Sober | Adjacent | Sober counter, pledges, community | Global | Free + Plus | No in-the-moment tools | [App Store](https://apps.apple.com/app/id672904239) |
| Headspace | Adjacent | "Panicking SOS" exercise, large library | Global | Subscription | Library, not quick tools | [Headspace](https://headspace.com/content/meditation/panicking-sos/60) |
| Calm | Adjacent | Breathing sessions | Global | Varies by country | Same | [Calm support](https://support.calm.com/hc/en-us/articles/360008240934) |

### 9.7 Me (profile and settings)

Not researched as a competitive category. Profiles and settings are table stakes, not a source of differentiation. Count: n/a.

### 9.8 Gym and workout partners: 7 direct + 13 adjacent = 20 (added in revision)

Full tables and sources: `GYM_ACTIVITY_RESEARCH.md` §5.

- **Direct (7):** Brocnbells/SweatBuddies ([site](https://brocnbells.com/mumbai/find-gym-buddy)), SpotYourMatch ([App Store](https://apps.apple.com/app/id6754750031)), FitFriends ([App Store](https://apps.apple.com/us/app/id6468023048)), Gymder ([App Store](https://apps.apple.com/us/app/id6756060937)), GymBudd ([App Store](https://apps.apple.com/us/app/id6753628386)), Gymly ([App Store](https://apps.apple.com/tr/app/kirve/id6444704794)), Fit-Buddy ([App Store](https://apps.apple.com/us/app/id6450426723)).
- **Adjacent (13):** Playo, Hudle, Cult.fit (Cult Moments), Fitpass, FITTR, GymRats, Hevy, Strava, Strong, Bumble For Friends, Meetup, stickK, Timeleft.
- **What it means:**
  - Dedicated gym-buddy apps exist but have very few ratings (0–14), and some look stale [Evidence: App Store listings]. Getting enough users in one place is the problem, not features.
  - Only SpotYourMatch and Brocnbells tie matching to a gym + time. None in the sample combines open slots, approval and recurrence.
  - The Indian incumbents each cover only part of the job: Playo has hosting for sports, Cult Moments shows class-mates afterwards, Fitpass has multi-gym access.

### 9.9 Totals, overlaps, gaps

| Tab | Direct | Adjacent | Total |
|---|---|---|---|
| Overview | 4 | 0 | 4 |
| Connect | 8 | 8 | 16 |
| Move & Coach | 5 | 1 | 6 |
| Sanctuary | 3 | 3 | 6 |
| Posture & Gaze | 4 | 2 | 6 |
| UrgeSurfer | 2 | 5 | 7 |
| Me | n/a | n/a | n/a |
| Gym / workout partners (revision) | 7 | 13 | 20 |
| **Unique products overall** | | | **56** (was 44). Cult.fit is counted once across Connect, Move & Coach and Gym. Gym added 12 new products; the other 8 (Playo, Hudle, Cult.fit, FITTR, Strava, Bumble For Friends, Meetup, Timeleft) were already counted |

**Gaps that are credible [Assumption, based on what was *not found*]:**
1. Walk/run/gym meetups with women-only and comfort controls, no booking needed, positioned as platonic (the V0 wedge).
2. Eye-level + activity-aware webcam posture (not verified at any competitor). This is a possible standalone product.
3. A rhythm-tap craving interrupt (not verified elsewhere). Too small to build a business on.

**Research limitations:**
- Search snippets rather than full page reads for several claims.
- Some secondary sources (StopSlouching, PostureCorrector, WHOOP and Breathwrk prices).
- Most Indian prices are unverified.
- Some sources are old (Strava 2017).
- US-based search may miss regional Indian apps.
- Not verified at all: Hudle and KheloMore host approval, and whether any Indian app offers women-only activity settings.

---

## 10. Exact V0 scope

### 10.1 Must have

| Item | Why it's here | User problem | Impact | Depends on | Complexity | If postponed |
|---|---|---|---|---|---|---|
| Activity object + create flow (walk/run) | No activity = no product | "I want company at a set time" | Core | Auth, area picker | Medium | Nothing to join |
| Explore list + filters | Joiners need to find activities | "What's on near me?" | Core | Activities | Low–Med | Hosts never fill |
| Request to join + host approve/decline | Safety + host control | "I don't want just anyone" | High | Activities | Medium | Unsafe or unwanted joins |
| Capacity, status, slots left, auto-"full" | Prevents overbooking | "Will there be space?" | High | Participants table | Medium (race-safe) | Overfilled meetups |
| Cancel (host) / withdraw (participant) + notifications | Plans change | "Is it still on?" | High | Notifications | Low–Med | No-shows, broken trust |
| Email + in-app notifications for request, decision, cancellation, withdrawal | People aren't in the app | "Did anyone respond?" | Very high | Email infra (exists) | Medium | Hosts miss requests, so activities don't fill |
| Activity chat, unlocked on approval | Coordinate on the day | "Where exactly are you?" | High | Groups (exist) | Low | Coordination moves to WhatsApp and we lose the loop |
| Location privacy (area public, exact point approved-only) | Safety | "Strangers shouldn't see where I'll be" | High | Activities | Low | Safety incidents |
| Attendance confirmation (host marks who came) | North Star, trust | "Did it happen?" | High | Participants | Low | Can't measure value |
| Report/block on activity and profile screens | Safety | "This person behaved badly" | High | Reports (exist) | Low | No recourse |
| Basic profile (name, photo, short bio) | Trust | "Who is this?" | Medium | Profile (exists) | Low | Fewer approvals |
| Remove fake verification (D30/D36) | Honesty | | High | Config | Very low | Liability |

### 10.2 Should have

| Item | Why | Complexity | If postponed |
|---|---|---|---|
| Reminder ~1–2 h before start (email) | Cuts no-shows | Medium (scheduler; see §13) | More no-shows |
| Open-join option for hosts | Faster fills | Low | Hosts approve manually |
| Women-only activity setting | Safety wedge | Low (comfort matching exists) | Weaker wedge |
| "Duplicate activity" for recurring walks | Host retention | Low | Hosts re-type every time |
| Web push (installed PWA) | Faster than email | Medium | Rely on email |
| First-activity milestone card | Rewards the aha moment | Low (exists) | Less delight |
| **Gym category** (session type, optional level, private "my gym" filter, "Repeat this session", capacity 2–4) | Highest repeat potential; same flow (D39) | Low | Lose the most retention-friendly category; still learn from walk/run |

### 10.3 Later (V1+)

Recurring schedules (including true recurring gym sessions), gym-partner check-ins/streaks (GymRats-style), a curated gym list, map view, more categories (cycling, yoga, then racquet sports), waitlist, curated venue list, real selfie verification provider, hosts' community pages, ratings, and payments (only if a category needs them).

### 10.4 Questions about how simple V0 can be

| Question | Answer |
|---|---|
| One category or several? | **Three**: walk and run (primary) + gym (secondary). Gym costs two optional fields and adds the strongest repeat behaviour; football and badminton would bring booking and payments. |
| Basic or rich profiles? | **Basic.** |
| Manual venue or directory? | **Manual** meeting point. |
| In-app or push notifications? | **Email + in-app** (Must); push (Should). |
| Join requests or auto-join? | **Requests by default,** auto-join as a host option. |
| Basic coordination or full chat? | **Activity group chat** (already built), no extra chat features. |
| Few fields or rich customisation? | **Few:** pace/intensity, capacity, women-only, notes. |
| List or map discovery? | **List.** |

### 10.5 Explicitly excluded from V0, and what building them early would cost

| Excluded | Opportunity cost if built early |
|---|---|
| Wellness score / Overview dashboard | Splits Home attention; needs 5 modules running; competes with wearables |
| Move & Coach (AI coach, workouts, library) | Ongoing content and AI-safety upkeep in the most crowded category |
| Sanctuary (habits, circadian) | Competes with Finch and RISE for no social benefit |
| Posture & Gaze Guard in the social app | Different user and device; real-person validation and model upkeep, and it pulls effort away from making meetups work |
| UrgeSurfer | Mental-health duty of care without clinical support |
| "Now" live radar | Requires both people online at once; worst cold start |
| Turf sports, venue booking, payments | Months of partnership and payment work to *reach parity* with Playo |
| Peer ratings / reviews | Needs volume; invites abuse |
| Map discovery | Build time with little V0 value |
| Native apps | Store overhead; slows iteration |
| Gym directory / live availability / gym-management or pass integrations | Partnerships and data upkeep before gym demand is proven |
| Workout-plan generation for gym partners | Re-opens Move & Coach's crowded, advice-risky category |
| Advanced gym matching (goals, splits, lift numbers, body data) | Over-segments a small pool and collects sensitive data |
| Public "members at my gym" directory | Routine-exposure and stalking risk (D42) |

**Kept even though they aren't differentiating:** authentication, account export and deletion, moderation tools, rate limits, security headers, accessibility work and error reporting. A real-world social app can't operate safely without them.

---

## 11. User journeys and failure cases

### 11.1 Host journey

1. Sign up or log in (email code) → set name, photo, comfort preference.
2. Explore → "+ Create" → pick Walk or Run.
3. Date/time → meeting point (map or search) → capacity → pace → women-only (optional) → notes.
4. Publish → status "Open" → appears in Explore for nearby users.
5. **Receives a request** (email + in-app) → views requester's profile → Approve / Decline.
6. Approved participant gets the exact meeting point and joins the activity chat.
7. When capacity is reached → status "Full" → listing shows "Full".
8. (Should) Reminder email to everyone before the start.
9. After the activity, the host marks who attended → status "Completed" → first-activity milestone.
10. *Or* the host cancels → every participant is notified with the reason.

### 11.2 Participant journey

1. Sign up or log in → Explore (sorted by start time and distance; area shown, exact point hidden).
2. Open the activity → host's first name + photo, pace, slots left, approval required, notes.
3. Request to join → status "Requested" (no duplicate requests possible).
4. **Approved** (email + in-app) → exact meeting point unlocked, chat opens. **Declined** → polite notice and suggestions of similar activities.
5. Coordinates in chat → attends. *Or* withdraws → host notified, slot reopens.
6. After the activity → shown as attended → milestone → "Walk again with Priya?" (repeat participation).

### 11.3 Failure cases

| Case | Required behaviour |
|---|---|
| No relevant activities | Empty state: "No walks near you yet. Host the first one", with a pre-filled create form |
| Activity becomes full | Request button disabled ("Full"); pending requests auto-declined with a notice [Recommendation] |
| Last slot contested | Server checks capacity atomically, so only one person gets it; the other sees "Just filled" |
| Host cancels | Status → cancelled; all approved and requested people notified; chat stays read-only |
| Participant withdraws | Slot reopens; host notified; repeated late withdrawals are logged for later trust signals |
| Request declined | Notice + similar activities; no reason shared unless the host gives one |
| Duplicate join request | One row per person per activity, so a second tap does nothing |
| Notification delivery fails | In-app inbox still shows it; email failures reported (error reporting exists); retried once |
| Missing or invalid location | Can't publish without a meeting point inside the launch area |
| Activity time passed | Status → expired (no joins); host prompted to confirm attendance within 48 h |
| Suspicious behaviour | Report (with category) + block from activity and profile; moderation queue (exists); restrictions (exist) |

### 11.4 Minimum safety, trust and privacy set

- **Location:** public listings show the area and rounded distance only. The exact point is visible to approved participants only.
- **Approval:** on by default.
- **Comfort settings:** women-only and comfort preferences, enforced on both sides.
- **Reporting:** report and block everywhere a person appears.
- **Enforcement:** restrictions for reported users (exists), and a moderation queue reviewed daily during launch.
- **Honest badges:** no "verified" badge until verification is real.
- **Safety tips:** shown on first join ("meet in public, tell a friend").
- **Data rights:** export and delete account (exists). Plan to meet India's Digital Personal Data Protection Act obligations for location and profile data; get legal review before scaling.

---

## 12. Metrics

### 12.1 North Star Metric

**Weekly completed group activities.**
- **Definition:** count of activities in a calendar week with status `completed`, where the host marked at least one approved participant as attended.
- **Why this metric:** it measures the real outcome (people moved together), not intent (activities created) or vanity (app opens).
- **Instrumentation:** new (`activities.status`, `activity_participants.attended`).

### 12.2 Supporting metrics

| Area | Metric | Numerator / denominator | Data |
|---|---|---|---|
| Activation | New users with a completed activity within 14 days | users with ≥1 attended completed activity ≤14 d after signup / new users | New |
| Creation | Activities published per week (per active host) | count of published activities | New |
| Discovery | Explore → detail view rate | detail views / Explore sessions | New (events) |
| Join conversion | Requests per detail view; approval rate | requests / detail views; approved / requests | New |
| Fill | **Fill rate** | activities reaching capacity (or ≥2 approved) before start / published activities | New |
| Time to fill | Median hours from publish to first approval and to full | timestamps | New |
| Completion | Completion rate | completed / (published − cancelled) | New |
| Attendance | Show-up rate | attended / approved participants of completed activities | New |
| Repeat | 30-day repeat participation | users with ≥2 attended activities in 30 days / users with ≥1 | New |
| Host retention | Host return rate | hosts publishing again within 30 days / hosts | New |
| Participant retention | Week-4 retention | participants active in week 4 / week-1 cohort | New |
| Notifications | Email open / click; time to host response | opens / sent; median request→decision time | New |
| Safety & failure | Reports per 100 activities; cancellation rate; "no one showed" rate | as named | Reports: **existing**; others new |

**Already measurable today [Evidence]:**
- Connections and acceptance rate (`connections`).
- Group membership (`group_members`).
- Self-logged joint sessions (`activity_sessions`).
- Messages, reports and restrictions.

These can give a baseline for the current Connect before V0 ships.

### 12.3 Validation experiment (runs with the build, D6)

**Setup:** in one campus or neighbourhood, for 2 weeks, run 10–15 walks and runs posted by hand (WhatsApp group + a simple form). Approvals, reminders and attendance are handled manually.

**Revision: add a third arm for Gym.** Post 10 or more gym sessions at the busiest gym times, in the same community. Measure for each arm:
- fill rate;
- time to first partner;
- show-up rate;
- **repeat pairs** (the same pair meeting ≥2 times in 2 weeks);
- for gym only, the % of joiners who actually had access to that gym.

Gym is promoted to primary if its fill rate is within 10 points of the best arm *and* its repeat-pair rate is the highest. A 1-week interest form (gym + usual training time) checks gym liquidity even more cheaply. See `GYM_ACTIVITY_RESEARCH.md` §13.

**Go / no-go thresholds [Recommendation; adjust after week 1]:**
- ≥50% of posted activities get at least one approved joiner.
- ≥60% of approved joiners show up.
- ≥30% of attendees join a second activity within 2 weeks.

**If it misses:** test a different activity (yoga, cycling) or audience before scaling the build.

---

## 13. Technical feasibility

### 13.1 Reuse (exists today)

- **Auth and sessions:** sessions, email codes, rate limits, CSRF protection and security headers.
- **Location:** `AreaPicker` (Leaflet + OpenStreetMap), `/api/geo/search` (Nominatim, throttled to its usage policy), and coarse-location helpers (`geo.ts`).
- **Chat and realtime:** groups and group chat (re-point at activities), plus realtime (Ably or SSE) with polling fallback.
- **Trust and safety:** reports, block, restrictions, moderation page, comfort matching, profile photos.
- **Rewards:** milestones and celebration cards.
- **Email:** SES or SMTP delivery, already used for login codes.
- **Operations:** error reporting, health check, Vitest and API test harness.

### 13.2 New work

| Area | Work | Notes |
|---|---|---|
| Schema | `activities`, `activity_participants`, `notifications` (§8.2) | Additive migration; nothing existing is altered |
| API | create, list (area + date + filters), detail (privacy-aware), request, approve/decline, withdraw, cancel, attendance | All use `requireUser`; host-only actions checked server-side |
| Notifications | Write to `notifications` + send email; in-app inbox UI | Move from Gmail SMTP to SES before scale (D38) |
| Scheduler | Reminders and expiry | The existing daily cron is too coarse for "1 h before". Vercel's Hobby plan limits cron frequency (check current limits), so use expiry-on-read (already the pattern in `findDb.ts`) plus a more frequent job on a paid plan or an external scheduler |
| UI | Explore, Create, Activity detail, My Activities, inbox; navigation change (§7.4) | |
| Flags | Hide the five modules | Code stays |

### 13.3 Rules, permissions and safety in code

- **Who can do what:** only the host can edit, cancel or approve. The host can't request their own activity. Restricted users can't create or join (the restriction system exists). Women-only activities only accept matching users (comfort matching exists).
- **Duplicate requests:** `unique (activity_id, user_id)`.
- **Last-slot race:** approve inside a transaction that locks the activity row (`select … for update`) and re-checks `approved_count < capacity` before updating. The same applies to open-join.
- **Validation:** start time between now and 14 days ahead; capacity 2–10; meeting point inside the launch area; notes length limited.
- **Privacy:** the list and detail endpoints never return the exact meeting point unless the caller is the host or an approved participant.
- **Tests:** unit tests for the state machine (requested → approved/declined/withdrawn; open → full → completed/cancelled/expired); API tests for permissions, the last-slot race (parallel requests), privacy of the exact location, and notifications sent.
- **Monitoring:** error reports on notification failures; a weekly North Star query.

### 13.4 Existing issues to resolve alongside V0

- **D36:** `VERIFICATION=off` in production.
- **D37:** remove the duplicate Vercel project.
- **D38:** move email to SES.
- **Exercise photos:** licence unknown; matters only if Move returns.

---

## 14. Roadmap and acceptance criteria

### 14.1 Phases

The durations below are rough estimates for one or two engineers, not commitments.

| Phase | Contents | Rough duration |
|---|---|---|
| **V0-a: validation (in parallel)** | Concierge test (§12.3); D36–D37 operational fixes | 2 weeks |
| **V0-b: build** | Schema + APIs + Explore/Create/Detail/My Activities + approval + email/in-app notifications + activity chat + attendance + privacy + navigation (4 items) + hide modules | ~3–5 weeks |
| **V0-c: launch** | One community; daily moderation; weekly metrics review | 4 weeks of measurement |
| **V1** | Reminders, open-join, duplicate/recurring, web push, waitlist, first-activity milestone polish, curated meeting points | After V0 metrics |
| **Later** | More categories (cycling, yoga, then racquet sports), map view, real verification provider, community pages; revisit "Now" matching once there's density; Posture as a standalone experiment | Driven by data |

**Order of work:**
1. Schema.
2. Create and list APIs.
3. Request and approve, with race safety.
4. Notifications.
5. Chat link.
6. Attendance.
7. UI and navigation.
8. Hide modules.

Notifications must ship together with approval; approval without notifications fails.

### 14.2 Acceptance criteria for the core journey

1. A host can publish a walk or run with time, meeting point, capacity (2–10), pace and notes. Invalid input is rejected with a clear message.
2. A different user within the area sees it in Explore within one refresh. They see the area and distance, never the exact point.
3. Requesting twice creates one request. The host receives an email and an in-app notice within one minute.
4. Approving reveals the exact point to that participant and adds them to the activity chat. Declining notifies them, and the exact point stays hidden.
5. With one slot left and two simultaneous approvals or open-joins, exactly one succeeds and the other sees "Just filled".
6. Host cancellation notifies all approved and requested users. Participant withdrawal notifies the host and reopens the slot.
7. After the start time, joining is closed. The host can mark attendance, and completion with ≥1 attendee counts toward the North Star.
8. Reporting from an activity or profile reaches the moderation queue, and blocking hides each user from the other.
9. Women-only activities can't be requested by users who don't match.
10. The five hidden modules aren't reachable from navigation, and their routes are behind a flag.
11. *(Gym)* A host can publish a gym session with a gym name + pin, session type, 1–3 partner spots and an optional level, using the same request/approve/chat/attend flow. A user's saved "my gym" filters Explore but is never shown on their profile. "Repeat this session" creates the next session and invites previous partners first.

---

## 15. Risks, assumptions and open questions

| Type | Item | Mitigation / how to resolve |
|---|---|---|
| Risk | **Cold start:** empty Explore | One community (D5); seed hosts (recruit 10 regular walkers/runners); concierge test |
| Risk | Safety incident at a meetup | Approval default, location privacy, women-only, report/block, restrictions, tips, daily moderation |
| Risk | Hosts miss requests (email in spam, Gmail limits) | SES (D38), in-app inbox, web push in V1 |
| Risk | Coordination moves to WhatsApp, losing measurement | Attendance confirmation in-app; keep the chat simple and useful |
| Risk | Sunk-cost pressure to keep the modules visible | Hidden, not deleted (D15); revisit with data |
| Assumption | Walk/run partner demand is strong enough | Concierge test thresholds (§12.3) |
| Assumption | Enough people share the same gym and time slot to fill gym sessions | Gym arm of the concierge test + interest form (`GYM_ACTIVITY_RESEARCH.md` §13) |
| Risk | Gym matching drifts into dating or harassment | Platonic positioning (D47), report category, restrictions, women-only sessions |
| Assumption | Women-only/comfort settings are a real differentiator | Verify hands-on in Playo/Hudle; ask in user interviews |
| Assumption | Turf-sports apps under-serve walking/running | Hands-on check of Playo, Hudle, Strava clubs in the launch city |
| Assumption | Email is good enough for V0 notifications | Track time to host response; add push if slow |
| Open question | Which community launches first (campus vs. neighbourhood)? | Founder decision. A campus has density and an identity check (college email) for free |
| Open question | Should a college-email requirement replace verification at launch? | Strong cheap trust signal if the launch is on a campus [Recommendation to consider] |
| Open question | Keep the Winter Arc promise to existing users until 31 Dec? | Recommended yes (D9); decide how to message it if Move is hidden |
| Open question | Posture as a separate product: who owns it, and is it worth it? | Decide after V0; it needs real-person validation first |

---

## 16. Final answer

> **"If I were starting togetherfit today and had limited engineering time, which features would I build first, which would I deliberately avoid, and why?"**

**Build first.** Host-posted **walking and running activities**, plus **gym sessions as a secondary category in the same flow** (revision), with:
- capacity;
- **request-and-approve joining**;
- an **exact meeting point shown only to approved people**;
- **email and in-app notifications** for every request, decision, cancellation and withdrawal;
- the **existing group chat** attached to each activity;
- **attendance confirmation** after the activity;
- the existing **report, block, restrictions and women-only comfort settings**.

Launch it in **one campus or neighbourhood**, behind a four-item navigation (Explore, My Activities, Chats, Me). While building, run a two-week manual test with real walkers, runners and gym-goers (three arms) to confirm demand, and to decide whether Gym becomes a primary category.

**Deliberately avoid:**
- the wellness score dashboard, Move & Coach, Sanctuary, UrgeSurfer, and Posture & Gaze Guard inside this app (hide them; don't delete them);
- the "Now" live radar;
- turf sports, venue booking and payments;
- gym directories, gym-software or pass integrations, workout-plan generation and advanced (body or lift data) gym matching;
- peer ratings, map discovery and native apps;
- any "verified" badge until verification is real.

**Why:**
1. **Audit.** The parts that make meetups work (auth, chat, safety, comfort matching, location privacy helpers, email delivery) already exist. The single missing piece is the Activity object plus notifications, a contained build (§13).
2. **Competitors.** Turf sports coordination is already served almost completely by Playo, Hudle, KheloMore and Turf Town (§9.1). Every wellness module faces several established apps (§9.2–9.6). Walk/run meetups with safety controls is the only gap that is both credible and cheap [Assumption to validate].
3. **Scores.** Connect scores 4.20 against 2.15–2.63 for the wellness modules (§7.2). Only Connect has network effects and a measurable real-world outcome.
4. **Validation.** The North Star (weekly completed group activities) and the concierge thresholds (§12.3) give a clear go/no-go within about six weeks, before more of your limited time is spent.

---

*No application code, configuration, database or deployment was changed while preparing this document. The only file created is this one.*
