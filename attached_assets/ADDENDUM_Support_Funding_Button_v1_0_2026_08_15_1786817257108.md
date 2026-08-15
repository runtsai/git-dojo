# ADDENDUM — Add a "Support This Project" link (not a donation button)

*Paste into the same Replit Agent chat that's already building Git Dojo. This is a small addition, not a new build — don't restructure anything else.*

---

## THE ASK

Add a simple, honest way for people using the app or looking at the public repo to voluntarily support RTS.AI. This is explicitly **not** a charitable donation (RTS.AI is an LLC, not a nonprofit — nothing here is tax-deductible, and the copy must never imply otherwise). Call it **support**, a **tip**, or a **contribution** everywhere in the UI — never "donate" or "donation."

## WHAT TO BUILD

1. **A single "Support this project" link/button**, placed somewhere sensible and non-intrusive — a footer, an About/Credits screen, or near the completion-ledger/certificate screen at the end of Tier 6 (a natural moment: someone who just finished the course is the most likely person to want to say thanks).
2. **It's a link, not a payment form.** Point it at a Stripe Payment Link (I'll create this myself in my Stripe dashboard — no code, just a URL I'll paste in once it exists; use a placeholder for now). Do not build any custom payment/card-collection UI, do not store or touch any payment data in this app at all. Keep the app's own codebase completely free of payment logic — it's just an outbound link.
3. **Use this copy** (adjust tone to match the rest of the app's voice, but keep the meaning intact):

   > "If Git Dojo saved you time or helped it click, you can support the team building it. This isn't a donation — RTS.AI is a company, not a nonprofit — just a way to say thanks and help fund what we build next, open source and otherwise."

4. **No tiers, no rewards, no membership.** This is a simple one-time show of appreciation, not a paid product tier or subscription — don't build any gated content, badges-for-payment, or "sponsor perks." Keep the course itself completely free either way.

## ALSO DO THIS (outside the app, on github.com — mention it to me if you can't do it yourself)

Enable **GitHub Sponsors** on the `runtsai` account/repo. This is a separate, complementary path — it puts a native "Sponsor" button directly on the GitHub repo page for anyone who finds the project there instead of the live app. It requires manual setup on github.com/sponsors (identity verification through GitHub, a couple of tip tiers or a one-time-only option) — flag clearly if this needs to happen outside this chat.

## HARD RULES

1. Never use the word "donation" or imply tax-deductibility anywhere in the UI or copy.
2. Never store, process, or touch payment/card data directly in this app's own code or database — outbound link only.
3. Never gate any course content behind payment. The whole point of this app stays intact: free, open, zero-gating.
