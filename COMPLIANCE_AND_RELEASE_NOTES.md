# LGW MeritX release and compliance notes

Reviewed 26 October 2026. This is an engineering risk note, not a legal opinion.

## Real-money feature status

Wallet deposit, withdrawal, wallet-paid entry, and cash-prize distribution are disabled in production. The repository does not contain a written legal opinion, a game-specific government determination, or provider approval for this paid-entry competition model. A feature switch is not a substitute for that evidence. The existing Razorpay checkout remains usable only in a non-production environment with explicitly supplied provider credentials; no credentials are shipped as defaults. The virtual demo wallet uses non-purchasable, non-transferable DMC credits only.

## Indian online-gaming framework checked

- The Promotion and Regulation of Online Gaming Act, 2025 (Act 32 of 2025) received assent in August 2025. The Central Government appointed 1 May 2026 as commencement under section 1(3); sections 5 and 7 address online money games and transfer of funds. [India Code bare Act (PDF)](https://www.indiacode.nic.in/bitstream/123456789/22148/1/a2025-32.pdf), [MeitY bare Act (PDF)](https://www.meity.gov.in/static/uploads/2025/10/8a7f103cefc68ed8aaa2ebc9a2ed7c13.pdf)
- The Promotion and Regulation of Online Gaming Rules, 2026 also came into force on 1 May 2026. They provide for game-specific determination and registration processes, including consideration of payment facilitation and user safety. [MeitY/Gazette Rules, 2026 (PDF)](https://www.meity.gov.in/static/uploads/2026/04/7e0b02d37fd07f81fa48578a9996aa85.pdf)
- The Act's preamble covers educational games among the sector, but that alone does not decide whether a competitive exam with paid entry and monetary prizes falls within the prohibition. No legal classification for this exact MeritX activity was found in the repository or supplied by the business. Treat the paid-entry cash-prize model as unapproved until counsel and the Authority's applicable process resolve it.
- The Supreme Court's 27 April 2026 office report listed the consolidated constitutional challenge for 28 April 2026 and recorded it as a challenge to the Act. This is a procedural case report, not a merits judgment; the latest operative order after that docket entry must be checked before any launch decision. [Supreme Court office report (PDF)](https://api.sci.gov.in/officereport/2025/54686/54686_2025_2026-04-28.pdf)
- Razorpay's terms prohibit unlawful or policy-prohibited businesses. Its current terms do not constitute written approval for this specific MeritX model; no account-specific approval was supplied. [Razorpay Terms](https://razorpay.com/terms/)

## Before production activation

Obtain written advice on the exact product and states served, determine whether a game-specific Authority process applies, and obtain written payment and payout provider approval. Separately complete appropriate age/identity controls, KYC/AML, tax, consumer-protection, privacy, refunds, and payout obligations. Reassess the legal framework, rules, and relevant court orders at release time. Until then, keep production payment endpoints unavailable and award only DMC credits.

## Configuration

- `VITE_GOOGLE_CLIENT_ID`: Google OAuth web client ID; configure its authorized JavaScript origins.
- `GOOGLE_CLIENT_ID`: matching server-side audience for backend ID-token verification.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`: leave unset unless operating an approved non-production/test integration. Production payment APIs remain blocked by the server.
- Apply database migrations automatically at backend startup, including `008_scheduling_demo_wallet.sql`.
