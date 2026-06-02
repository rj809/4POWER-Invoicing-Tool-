# 4POWER Invoice Generator

A self-contained, browser-based generator for 4POWER Proforma and Commercial (Tax) invoices.
No backend, no build step — a single `index.html` served as a static site.

## What it does
- Two modes: **Proforma** and **Commercial Invoice** (title, reference label and Bigin target switch per mode)
- Manual reference field (Proforma reference / Tally invoice number — Tally remains the system of record)
- Dropdown-driven entry: customer, payment terms (auto due date), VAT rate, declaration, remit account
- Product catalogue so line items auto-fill Part #, Description, HSN and unit price
- Unlimited line items, automatic USD/AED totals, automatic amount-in-words
- Print / Save PDF with automatic page breaks and a repeating table header
- Save / Load `.json` and local autosave

## Branding
Palette C — navy `#0B1C3E`, lime `#A3E635`, teal `#0FB39A`. Raleway + Manrope.
4POWER logo is inlined as SVG and must not be redrawn or recoloured.

## Deployment
Connected to Netlify; any push to `main` redeploys automatically.
Publish directory: repository root. No build command.

## Roadmap
- **Phase 2 (live):** type-to-search customer lookup from Zoho Bigin via the n8n "Bigin Bridge" webhook
  (`/webhook/bigin-bridge`). Selecting a company pulls its contacts (Attention) and open deals
  (Your Ref / PO). Billing address is pulled when present in Bigin, otherwise typed manually.
  Falls back to the local list if the webhook is unreachable.
- **Phase 3:** attach the generated PDF to the Bigin deal and advance its pipeline stage
  (Proforma → Orders : Order Received; Commercial → Payment Outstanding).
