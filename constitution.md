# Project Constitution
**Project:** Goal-Based Training Program Platform (working title)
**Phase:** 0 — Constitution
**Status:** Ratified Draft v1.0
**Last Amended:** 2026-09-22

> This document is the supreme governing artifact of the project. Every Specification, Plan, and Task produced in later SDD phases MUST comply with the Articles below. A spec or plan that conflicts with this Constitution is invalid until either the spec is revised or this Constitution is formally amended (see Article IX).

---

## Article I — Mission & Product Identity

1.1. The product is a **standalone, cross-platform mobile/web application** for hosting individually purchasable, goal-based workout training programs.

1.2. The product is **independent of the founder's personal website**. It shares no authentication, user records, or purchase history with that site at this time. Any future bridge (e.g., cross-platform promo codes) is an explicit future amendment, not an assumption baked into v1 architecture.

1.3. The product's differentiating pillar is **data-driven progress visualization**: every program purchase results in a trackable, graphable, gamified record of the user's performance over time — not merely a static PDF or video library.

1.4. The long-term vision includes **expansion to adjacent digital product lines** (e-books, cookbooks, memoirs) under the same commerce and account infrastructure. The Constitution does not require these to be built now, but **no architectural decision in Phase 1+ may foreclose this expansion** (e.g., the product/catalog data model must be type-agnostic from day one).

---

## Article II — Core User Experience Principles

2.1. **The Program is the unit of purchase.** Each program is a discrete, independently priced product containing its own exercises, schedule, progression logic, strength-calculation method, and unique trophy/token artwork.

2.2. **No coaching layer exists in-app.** Programs are self-directed content. Trainers, coaches, celebrities, and influencers whose names/likenesses are attached to a program provide no live coaching, messaging, or client management through this platform. This MUST be stated in program terms of sale to avoid user confusion and liability.

2.3. **Real-time is defined as end-of-session or end-of-day, not mid-session streaming.** The dashboard and progress graphs update either (a) immediately when a user marks a workout complete, or (b) automatically at the start of the next calendar day if the workout was never explicitly closed out — whichever occurs first. Any set/rep/weight fields left unrecorded at that trigger point are saved as zero, never null, to preserve graph continuity.

2.4. **The Gamified Program Card is a first-class UI object**, not a decorative afterthought. It must always render: (a) live statistical dashboard data, (b) performance graphs, (c) user-submitted pre/post photos, and (d) the program's unique trophy/token — as two conceptually distinct faces of one card.

---

## Article III — Content & Program Model

3.1. Programs are authored **only by the platform owner/team** in v1. There is no self-serve creator marketplace, no third-party program upload flow, and no revenue-sharing infrastructure for trainer-authored content beyond the affiliate model in Article V.

3.2. Every program is defined by a **Program Definition Schema** (finalized in Phase 1 Specify) that must include, at minimum:
   - Program metadata (name, goal category, associated personality/brand if any)
   - Structured workout schedule (exercises, sets, reps, load progression rules)
   - A **program-specific strength-calculation formula**, since formulas are not global — each program declares its own method of computing "strength increase" at authoring time.
   - Trophy/token asset reference and unlock conditions.

3.3. Programs may be built around **specific goals, celebrities, or influencers** for marketing purposes. This is a permitted and expected content pattern, not an edge case.

---

## Article IV — Program Licensing & Endorsement Integrity *(Non-Negotiable)*

4.1. Any program associated with a real person's name, image, or likeness (celebrity, influencer, or coach) MUST have a documented licensing/endorsement agreement before that program is published. This is a legal, not merely technical, gating requirement, and the platform's data model must support storing/tracking the status of these agreements per program.

4.2. Where an affiliate commission structure exists for a named individual, the platform MUST support transparent, auditable commission tracking (who gets paid, on what sale, at what rate) and must accommodate **FTC-style affiliate/endorsement disclosure** at the point of sale or in program marketing materials. This is a compliance non-negotiable, not a "nice to have."

4.3. The founder is advised to involve legal counsel on likeness/endorsement agreements and affiliate disclosure language before onboarding any celebrity- or influencer-branded program; this Constitution does not substitute for that review.

---

## Article V — Commerce & Affiliate Model

5.1. Programs are sold as **individual, one-time (or optionally subscription) purchasable products** through a unified commerce layer.

5.2. The commerce/catalog layer MUST be **product-type-agnostic** — "program," "e-book," and future product types are all instances of a shared underlying product entity, differentiated by type and fulfillment logic, not by separate systems. This directly supports Article I.4's expansion mandate.

5.3. Affiliate sales tracking (Article IV.2) is a core commerce feature, not a bolt-on — commission attribution must be built into the purchase flow from v1, even if the UI for affiliate dashboards is deferred to a later phase.

---

## Article VI — Data, Privacy & Security

6.1. User data in this platform is **non-clinical** and does not require formal HIPAA compliance. However, the platform voluntarily adopts a **HIPAA-adjacent security posture** as a default engineering standard:
   - Encryption at rest and in transit for all user data.
   - Progress photos are **private-by-default**, visible only to the account owner unless the user takes an explicit, separate action to share them.
   - Users must be able to **permanently delete** their account, workout history, and photos on request.
   - No user data is shared with, or accessible from, the founder's personal website or any other property without explicit, separate user consent.

6.2. This standard applies retroactively to all future features unless explicitly and consciously downgraded via a Constitution amendment — it is not a target to "get to eventually."

---

## Article VII — Technical Foundation

7.1. **Cross-platform delivery** (iOS, Android, and web from a single codebase) is a non-negotiable requirement, given the founder's non-technical background and desire for maintainable, AI-assistable development.

7.2. Recommended baseline stack (subject to confirmation/revision in Phase 1 Plan, but treated as the default assumption unless a specific blocker emerges):
   - **Client:** React Native via Expo
   - **Backend/Data:** Supabase (Postgres, Auth, Storage, Realtime)
   - **Payments:** Stripe
   - **Rationale:** minimizes custom backend engineering, supports the Realtime/dashboard requirement (Article II.3) natively, and is well-supported by AI coding assistance — directly serving the founder's stated need for autonomous execution.

7.3. Offline support, precise 1RM/volume calculation engines, and other deep technical mechanics are **explicitly deferred to Phase 1 (Specify)** as open research questions, not resolved here.

---

## Article VIII — Constraints & Assumptions

8.1. No fixed budget or launch date is established as of this ratification. Phase 1+ specs should therefore default to **lean, incrementally shippable scope** rather than assuming unlimited runway.

8.2. The founder is building this **primarily solo, with AI assistance**, and expects execution systems (specs, plans, tasks) to be structured for maximum autonomous handoff to AI coding tools.

---

## Article IX — Governance & Amendment

9.1. This Constitution may only be amended by explicit, conscious founder decision — never silently overridden by a downstream spec or plan.

9.2. Any Phase 1+ document (Spec, Plan, Tasks) that conflicts with an Article above must either be revised to comply, or trigger a formal amendment to this Constitution before work proceeds.

9.3. Version history of this document should be preserved; amendments should be dated and briefly justified.

---

*End of Phase 0 Constitution v1.0*
