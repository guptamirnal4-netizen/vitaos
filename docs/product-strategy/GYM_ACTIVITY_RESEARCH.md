# Gym as a togetherfit activity: research and recommendation

**Prepared:** 19 October 2026
**Companion to:** `PRODUCT_DIRECTION_AND_MVP.md` (same folder). Its decision register, scope and roadmap have been updated to match this document.
**Mode:** research and documentation only. No application code, configuration, database or deployment was changed.

Labels:
- **[Evidence]**: verified in the code or a cited source.
- **[Assumption]**: believed but not proven; needs validation.
- **[Recommendation]**: my judgement.

---

## 1. Executive summary

**Decision: Gym goes into V0 as a secondary category.** It uses the same activity flow as walking and running, plus a few gym-specific fields. Walking and running remain the primary categories.

Gym moves up to primary if the validation test (§13) shows it fills sessions and keeps partners coming back better than walking and running.

**Why Gym belongs in V0:**
- **Best retention traits of any category.** People train 3–5 times a week, so a good partner pairing repeats naturally. Partner exercise is linked to longer persistence in controlled experiments (the Köhler effect) [Evidence, lab setting: [Univ. of Kent](https://kar.kent.ac.uk/41321), [Univ. of Kent](https://kar.kent.ac.uk/35027)].
- **Almost no extra build cost.** Gym is already a category in the code [Evidence: `src/lib/connect/sports.ts`, the "Find Gym Partner" button on `/move`, the `gym_session_completed` event]. It fits the shared activity model with three optional fields. No gym directory, booking or integration is needed.
- **Fits the campus launch.** A campus or society gym puts many potential partners in one place at predictable times, which eases the biggest gym-specific problem below.
- **Little real competition.** Dedicated gym-buddy apps exist, but each has 0–14 App Store ratings and several look stale. The Indian incumbents (Playo, Hudle, Cult.fit, Fitpass) each cover only part of the job (§5).

**Why Gym is secondary, not primary:**
- **A much smaller partner pool.** Walking and running only need someone nearby. Gym needs someone with access to the *same gym* at the *same time*, so outside a dense community, sessions may not fill [Assumption].
- **Demand is unproven** for togetherfit's users, and the empty competitor apps are a warning, not a validation.

---

## 2. Why Gym may fit togetherfit

1. **Accountability is the gym's core problem.** Gym-goers usually *know what* to do; the hard part is *going consistently*. A partner who expects you at 7 am is the simplest commitment device [Assumption; lab evidence in §1].
2. **Repeat use is built in.** A walking group might meet once a week; gym partners can meet several times a week. That multiplies the North Star (weekly completed group activities) per active pair.
3. **Semi-public and staffed.** A gym is staffed and has other people around, which makes it lower-risk for a first meeting than a dawn run on an empty road [Assumption]. Safety controls still apply (§11).
4. **Matches existing product signals.** The Move & Coach tab already has a "Find Gym Partner" call-to-action, and the workout player logs completed gym sessions.

---

## 3. Target user and key problems

- **Target user [Assumption]:** students and young professionals (about 18–30) who already have gym access (campus, society or commercial gym, or a multi-gym pass) and train irregularly.
- **Problems:**
  1. "I skip the gym when I go alone."
  2. "I don't know anyone at my gym who goes at my time."
  3. "I'd like to try lifting but feel intimidated going alone" (beginner anxiety) [Assumption].
  4. "I want a spotter or someone at my level for heavy days."
- **Not the target (V0):** people looking for trainers (trainer booking is out of scope), dating (explicitly platonic, see §11), or detailed programming (Move & Coach is hidden in V0).

---

## 4. Use-case evaluation

| Use case | V0? | User value | Technical complexity | Relevant competitors | Risks | How to validate |
|---|---|---|---|---|---|---|
| **A. Find a gym partner** | ✅ **Yes, as a scheduled session (merged with C)** | High: the core accountability need | Low (shared activity model) | Brocnbells/SweatBuddies, Gymder, FitFriends, GymBudd (§5) | Small pool per gym | Fill rate and time-to-fill for gym sessions |
| **B. Find people at the same gym** (a members directory) | ❌ **No directory.** Instead: a private "my gym" filter on sessions | Medium | Low for the filter; medium for a directory | Brocnbells ("same gym, same time"), Cult Moments (people from your class) | **A directory shows where and when someone reliably is: a stalking risk** | Count how often users filter by their gym |
| **C. Schedule a workout session** (date, time, gym, slots) | ✅ **Yes: this *is* the V0 gym flow** | High | Low | SpotYourMatch (sessions at gyms); Playo/Hudle for sports | No-shows | Completion and show-up rate |
| **D. Compatibility** (workout type, level, time, goals) | ✅ **Minimal**: session type + optional level; time comes from the session | Medium | Low | GymBudd (muscle group), SpotYourMatch (level, type) | Over-filtering empties the pool | Approval rate; "not a good fit" reports |
| **E. Consistency** (recurring sessions, regular partner) | 🟡 **Should**: V0 offers "Repeat this session"; true recurrence and partner streaks come in V1 | Very high | Low for duplicate; medium for recurrence | GymRats (group check-ins), Hevy (social logging) | Recurring schedules reveal routines (§11) | % of pairs with ≥3 sessions in 4 weeks |
| **F. Group workouts** | ❌ **Later.** V0 caps gym sessions at 4 people | Medium | Low (capacity) | Meetup groups, Cult classes | Gyms limit guests; groups of strangers are awkward on a gym floor | Demand for capacity >4 in the concierge test |

**Result:** the six use cases become **one V0 feature**: a scheduled gym session at a named gym, with request-to-join, plus a private "my gym" filter and "repeat this session". There is no separate "gym partner" product.

---

## 5. Competitor analysis (researched 19 Oct 2026)

**Method.** Web search of official sites, App Store listings, help centres and press. Google Play listings could not be read. Self-reported user numbers are not verified. App Store prices come from US/TR storefronts and may differ in India.

### 5.1 Direct: explicitly help people find workout partners or coordinate gym sessions

| Product | Capabilities (verified) | Audience / geography | Pricing | Strengths | Gaps / presence | Source |
|---|---|---|---|---|---|---|
| Brocnbells / SweatBuddies | Matching by goals, schedule, level; pick your gyms ("same gym, same time"); intent buddy/friend/date; messaging; social meetups | Singapore-led; has Mumbai and Delhi pages | Free; 5 connection requests/day | The closest model to togetherfit | India activity unverified; "date" intent mixes in dating | [brocnbells.com (Mumbai)](https://brocnbells.com/mumbai/find-gym-buddy) |
| SpotYourMatch | Matching on goals and gym; filters for level, type, availability; **create workout sessions at specific gyms**; messaging | Global (iOS) | Free; paid tiers $3.99–179 | Session-at-gym model | 5 ratings; v1.0.3 (Dec 2025) | [App Store](https://apps.apple.com/app/id6754750031) |
| FitFriends: Find Gym Partners | Partners at specific gyms, interest matching, chat, streaks | US, iOS | Free | Gym-anchored discovery | 2.8★ from 14 ratings; reviews mention no one nearby; last updated Aug 2024 | [App Store](https://apps.apple.com/us/app/id6468023048) |
| Gymder | Profiles, affinity matching, chat to coordinate workouts, verification | Global, iOS | Free | Long-running brand, frequent updates | Too few ratings to show a score; press frames it as dating-adjacent | [App Store](https://apps.apple.com/us/app/id6756060937) |
| GymBudd | Matching by goals and muscle group, workout planning, chat, trainer booking | Global, iOS | Free + in-app purchases | Muscle-group matching | Not enough ratings to show a score | [App Store](https://apps.apple.com/us/app/id6753628386) |
| Gymly | Location-based buddy discovery, lift stats, messaging | Turkey-origin, iOS | Freemium | Social + stats | 9 ratings (updated Jun 2025) | [App Store](https://apps.apple.com/tr/app/kirve/id6444704794) |
| Fit-Buddy | Partners, groups, coaches, feed | Global, iOS | In-app purchases $1.99–17.99 | Groups + partners | 4 ratings; last updated Sep 2024 | [App Store](https://apps.apple.com/us/app/id6450426723) |

### 5.2 Adjacent: communities, group fitness, accountability or tracking, without gym-partner scheduling

| Product | Relevant capabilities | Audience | Pricing | Implication for togetherfit | Source |
|---|---|---|---|---|---|
| Playo | Host/join activities by sport, skill, time; venue booking; lists "Workouts" and yoga | India | Free + in-app purchases | The Indian reference for "host a slot, others join", but for sports | [App Store](https://apps.apple.com/us/app/playo-sports-community-app/id1018786950) |
| Hudle | Venue booking, pick-up games, leagues | India | Venue booking | Sports, not gyms | [App Store](https://apps.apple.com/app/id1380053168) |
| Cult.fit (Cult Moments) | After a class, see other members who attended ("know your workout buddies") | India | Cultpass subscription (unverified) | Passive, classes only; no requests or scheduling (per its help page) | support.cure.fit ("What is Cult Moments") |
| Fitpass | Multi-gym access (12,000+ gyms, 150+ cities, self-reported), AI coach | India | Subscription (unverified) | Shared access makes "same gym" matching easier; no social features found [hypothesis] | [fitpass.co.in](https://fitpass.co.in) |
| FITTR | Coach-led community, paid coaching | India + abroad | Freemium + paid | No partner-finding found [hypothesis] | (press: Entrepreneur India, BusinessWorld) |
| GymRats | Group challenges, verified check-ins, leaderboards, chat | Global | Free; Pro $3.99/mo or $32.99/yr | Best-in-class accountability among people who already know each other; no stranger discovery | [App Store](https://apps.apple.com/us/app/id1453444814) |
| Hevy | Follow people, compare lifts, leaderboards, share routines | Global | Free; Pro from $4.99/mo | Gym-native social layer without scheduling [hypothesis] | [hevyapp.com](https://hevyapp.com/features/social-features/) |
| Strava | Strength-training activity type with sets/reps/weight; imports from Hevy and others | Global | Freemium | Moving into strength; could add gym social features | support.strava.com (strength training help article) |
| Strong | Workout tracker; share routines | Global | Free tier, 3 routines | Tracking only | [App Store](https://apps.apple.com/sg/app/id464254577) |
| Bumble For Friends | Friend-finding; "gym buddy" badges with adidas and Gymshark | Global (BFF in India unverified) | Freemium | Big network, but inside a dating brand | (press: The Drum, TechCrunch) |
| Meetup | Fitness and weightlifting groups | Global | Organiser fees | Recurring groups; India activity unverified | [meetup.com/topics/weightlifting](https://www.meetup.com/topics/weightlifting/) |
| stickK | Money-backed commitment contracts with a referee | Global (US) | Free; user sets the stakes | A proven commitment device, no partners | [Wikipedia](https://en.wikipedia.org/wiki/StickK) |
| Timeleft | Matched dinners with strangers | 62 countries; India unverified | Paid tickets | Shows demand for meeting strangers offline | [Tasting Table](https://www.tastingtable.com/1859085/dinner-parties-with-strangers-timeleft) |

**Excluded after checking:**
- **Pact (GymPact):** shut down after an FTC settlement ([MobiHealthNews](https://www.mobihealthnews.com/news/khosla-backed-fitness-startup-pact-shuts-down), [Fortune](https://fortune.com/2017/09/23/exercise-app-pact-settlement/)).
- **"SpotMe" and "FitMate" apps:** trainer or AI-coach tools, not partner finders.
- **"Gym Buddy" listings:** the pages couldn't be read.
- **FitMatch.in (Bengaluru):** the site failed to load, so unverified.

### 5.3 What the research means

1. **Getting enough users in one place is the real problem, not features [Evidence: rating counts and reviews above].** Dedicated gym-buddy apps exist globally, but have very few ratings, and at least one has "no one in my area" reviews. Launching gym nationwide would repeat their failure. Launching it inside one community is the right test.
2. **togetherfit's exact flow is rare.** Only SpotYourMatch and Brocnbells tie matching to a gym and a time. None of the apps checked combines open slots, request and approval, and recurring sessions [Evidence, within this sample].
3. **The Indian incumbents each cover one piece.** Playo has the hosting mechanic for sports; Cult Moments shows class-mates afterwards; Fitpass has multi-gym access [Evidence]. None does gym-partner scheduling, as far as this research found [hypothesis].
4. **Being clearly platonic is a gap.** Gymder and Brocnbells blur fitness and dating [Evidence: their positioning]. A clearly *platonic*, safety-first gym partner product, with women-only sessions, is a credible position in India [Assumption].
5. **Borrow accountability mechanics, don't compete with trackers.** GymRats and Hevy show check-ins, streaks and leaderboards work among people who already know each other. togetherfit's job is to *create* the pair; V1 can add GymRats-style check-ins for pairs.

---

## 6. Verified competitor counts (Gym)

| | Count |
|---|---|
| Direct | **7** (Brocnbells/SweatBuddies, SpotYourMatch, FitFriends, Gymder, GymBudd, Gymly, Fit-Buddy) |
| Adjacent | **13** (Playo, Hudle, Cult.fit, Fitpass, FITTR, GymRats, Hevy, Strava, Strong, Bumble For Friends, Meetup, stickK, Timeleft) |
| **Total for Gym** | **20** |
| Already counted in other tabs | 8 (Playo, Hudle, Cult.fit, FITTR, Strava, Bumble For Friends, Meetup, Timeleft) |
| **New unique products added** | **12** |
| **Unique products across the whole strategy** | **56** (was 44) |

These are relevant competitors found in this research, not a census of the market.

---

## 7. Minimum viable Gym activity flow

1. **Create → Gym.**
2. **Session type:** Strength · Cardio · General workout (one tap; default General).
3. **Gym:** type the gym name, then pin it with the existing map picker and place search. No directory.
4. **Date, start time.** Duration defaults to 60 min.
5. **Spots:** 1–3 partners (capacity 2–4 including the host).
6. *(Optional)* **Level:** Beginner · Intermediate · Advanced (self-declared).
7. *(Optional)* **Notes:** e.g. "Leg day, happy to spot", "members only".
8. **Join mode:** request & approve (default) or open.
9. **Publish.** It appears in Explore for nearby users and in the "my gym" filter for people who saved the same gym.
10. Requests, approval, chat, reminders, cancellation and attendance all work exactly as for walking and running.
11. **Repeat this session** creates the next session with the same details and invites the same approved partners first. This is the V0 stand-in for recurrence.

---

## 8. Required, optional and deferred fields

| Field | Classification | Why |
|---|---|---|
| Category: Gym | **Required** | Picks the rules and fields |
| Session type (strength / cardio / general) | **Required**, defaults to General | One tap; helps partners self-select without a matching algorithm |
| Gym name + location (manual, map pin) | **Required** | Joiners must know whether they have access. Manual entry avoids a directory |
| Date + start time | **Required** | Core of scheduling |
| Expected duration | **Optional** (default 60 min) | Useful for planning, not essential |
| Number of partners (1–3) | **Required** | Prevents overcrowding; gyms limit guests |
| Experience level | **Optional** | Helps beginners feel comfortable; self-declared, with no ratings |
| Training preferences (split, muscle group, goals) | **Optional, as free text in notes** in V0; structured fields **later** | Structured fields over-segment a small pool |
| Recurring-session preference | **Future** (V0 has "Repeat this session") | True recurrence needs scheduling and more privacy work |
| Host notes | **Optional** | Access rules ("members only"), plans, spotting |
| Join vs request-to-join | **Required**, defaults to request | Safety default shared with all categories |
| Women-only | **Optional** (shared field) | The comfort-matching wedge |
| **Never collected** | n/a | Body weight, measurements, body photos, injuries, medical conditions, lift numbers. Not needed to coordinate a session, and sensitive under India's DPDP Act |

**Gym location: manual entry vs. integrations [Recommendation]**

| Option | Recommended for V0? |
|---|---|
| Manual gym name + map pin | ✅ **V0** |
| Curated list of gyms in the launch community | V1, by hand, only if typos fragment the "my gym" filter |
| Gym directory, live availability, gym-management software, multi-gym-pass integrations | ❌ Not V0. Partnerships and data upkeep with no proof of demand yet |

---

## 9. Relationship with Football, Badminton, Running and Walking

### 9.1 One activity model for every category

The same create → discover → request → approve → chat → attend → complete flow, permissions, notifications and safety controls serve all categories. Only a small set of optional fields changes:

| Category | Shared fields | Category-specific optional fields | Needs venue booking or payment? |
|---|---|---|---|
| Walking | time, meeting point, capacity, join mode, women-only, notes | intensity (easy/moderate/brisk), duration | No |
| Running | same | pace band, distance | No |
| **Gym** | same (meeting point = gym) | **session type, level** | **No** (access is the user's responsibility) |
| Football | same | format (5/7-a-side), skill level | **Usually yes** (turf booking, cost split) |
| Badminton | same | singles/doubles, skill level | **Usually yes** (court booking) |

**Conclusion [Recommendation].** No separate workflows are needed. Gym fits as easily as walking and running because no booking or payment is involved. Football and badminton fit the data model too, but in practice they drag in booking and payments, the area where Playo, Hudle and KheloMore are strongest.

### 9.2 Category scores

Scores are 1–5, higher = better for V0.

**Weights:**
- Problem strength 10%.
- Frequency 15%.
- Repeat potential 15%.
- Accountability effect 10%.
- **Liquidity (size of the eligible partner pool) 15%.**
- Ease of seeding in one community 5%.
- Implementation ease 10%.
- Differentiation 5%.
- Safety/trust ease 5%.
- Can be organised without integrations 10%.

| Criterion | Walking | Running | **Gym** | Football | Badminton |
|---|---|---|---|---|---|
| Problem strength | 3 | 4 | 4 | 4 | 3 |
| Frequency | 4 | 4 | **5** | 3 | 3 |
| Repeat potential | 4 | 4 | **5** | 4 | 4 |
| Accountability effect | 3 | 4 | **5** | 3 | 3 |
| Liquidity (eligible partner pool) | **5** | 4 | **2** (same gym + same time) | 2 (needs 10+ players) | 3 |
| Ease of seeding in one community | 4 | 4 | 4 (campus gym) | 3 | 3 |
| Implementation ease (shared model) | 5 | 5 | 4 (+2 fields, "my gym" filter) | 2 | 2 |
| Differentiation vs. incumbents | 4 | 3 | 3 | 1 | 1 |
| Safety/trust ease | 3 | 3 | 4 (staffed venue) | 4 | 4 |
| No integrations needed | 5 | 5 | 4 (access rules) | 2 | 2 |
| **Weighted score** | **4.10** | **4.10** | **4.05** | **2.85** | **2.90** |

**How to read it:**
- Gym scores highest on everything that drives retention (frequency, repeat potential, accountability) and lowest on liquidity.
- **Gym is only 0.05 behind walking and running, and the ranking depends on the liquidity weight.** At 10% instead of 15% (re-normalised), Gym ranks first (≈4.16 vs ≈4.05). Whether Gym should be primary therefore depends on one measurable question: *do gym sessions fill in the launch community?* That's exactly what the experiment in §13 tests.
- Football and badminton stay **Later** (unchanged from the main document).

---

## 10. Product and technical dependencies

- **Reused:** the activity model, request/approval, notifications, activity chat, attendance, report/block/restrictions, comfort matching, area picker and place search. All are the same as the walk/run V0 in the main document.
- **New for Gym (small):**
  - **Fields:** `category = 'gym'`, plus optional `session_type` and `experience_level` on `activities`.
  - **"My gym" filter:** a private saved gym (name + rounded location) per user, used only for filtering. It's never shown on profiles.
  - **"Repeat this session":** copies an activity and invites the previous approved partners first.
  - **Deduplication:** matching gyms by name and location (normalise case and spacing; treat pins within ~150 m as the same gym) [Recommendation].
- **Existing code to align:**
  - The "Find Gym Partner" button on `/move` should point to the new gym Create/Explore flow (Move & Coach is hidden in V0 anyway).
  - `gym_session_completed` and gym milestones should count completed gym *activities*, not self-logged workouts.
- **Deferred:** gym directory, live availability, gym-management or pass-provider integrations, workout-plan generation, advanced matching (goals, splits, lift numbers), group classes, trainer booking.

---

## 11. Safety, trust and privacy

| Risk | Control |
|---|---|
| Routine exposure (same gym, same time, every week) | No public members directory (use case B rejected). A user's saved gym is private. Public listings show only the session itself, never a person's other sessions. Repeat sessions go to previous partners first |
| Unwanted romantic intent | Position as **platonic only** in copy and guidelines. Add a "dating or harassment" report category (categories exist). Restrictions on repeat reports (exist) |
| Women's safety | Women-only sessions (comfort matching exists); approval by default; staffed venue |
| Beginner intimidation or injury | Self-declared level; tips ("agree on the plan first; ask staff about equipment"). No coaching advice in V0 |
| Gym access rules (guests not allowed) | Notes field with "members only" default text; the joiner confirms they have access before requesting |
| Sensitive data | Never collect body, health or lift data (§8) |
| Fake "verified" badges | Same as the main document: no badges until verification is real |

---

## 12. V0 prioritization recommendation

- **Classification: Should Have** in V0. It ships in the same build as walking and running (Must), behind the same flow, launched in the same community.
- **What ships:** the Gym category, session type, optional level, the private "my gym" filter, "Repeat this session", and a capacity cap of 2–4.
- **What doesn't:** a gym directory, integrations, workout plans, advanced matching, group classes, true recurrence, partner streaks/check-ins (V1).
- **Promote Gym to primary** if, after 4 weeks in the launch community, gym sessions match or beat walking and running on **fill rate** and **repeat-pair rate** (§13).
- **Drop Gym from V1 focus** if fewer than 30% of gym sessions get an approved partner.
- **Gym strengthens the core hypothesis.** It's the category most likely to produce *repeat* completed activities. It distracts only if it is launched outside a dense community or grown into a fitness-programming product.

---

## 13. Validation experiments

1. **Three-arm concierge test (2 weeks, before or alongside the build).**
   - **Setup:** in the launch campus or community, post sessions by hand (WhatsApp group + form) for walking, running and gym. Use 10 or more of each, at the busiest times. Approve, remind and confirm attendance by hand.
   - **Measure per arm:** fill rate, time to first partner, show-up rate, and **repeat pairs** (the same pair meeting ≥2 times in 2 weeks).
   - **Gym-specific measures:** % of gym requests where the joiner had access to that gym; split between the campus gym and outside gyms.
   - **Decision rule:** Gym becomes a primary category if its fill rate is within 10 points of the best arm *and* its repeat-pair rate is the highest. Otherwise it stays secondary.
2. **"Find a gym partner" interest check (1 week, very cheap).**
   - A short form in the launch community: gym, usual training time, interest in a partner.
   - **Read-out:** if ≥20 respondents share a gym and a 1-hour window, liquidity is good enough for that gym.
3. **Post-launch instrumented test (4 weeks).**
   - Compare the categories on the main document's metrics (fill rate, completion, 30-day repeat participation, host return rate), using `category` as the split.
4. **Safety signal.**
   - Track reports per 100 gym sessions, by category ("dating/harassment" in particular).
   - Investigate any rate above walking and running before promoting Gym.

---

*Sources are cited inline. Limitations: search-snippet research, US/TR App Store storefronts, Google Play not readable, self-reported company figures not verified, small Indian startups possibly missed. The Köhler-effect evidence comes from lab studies (some with virtual partners); it supports the mechanism, not togetherfit demand.*
