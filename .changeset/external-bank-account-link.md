---
"@amos.com/amos-js": minor
---

Add the external bank account intent primitives.

`openPlaidPopupLink()` opens a regular (popup) Link session. This is the only
kind of session Plaid allows for an `update` link token — Embedded Institution
Search cannot resume an existing connection — so the mode now has to be chosen
rather than assumed. It rejects when the Link script loads without
`Plaid.create` instead of reporting a session that never opened.

The `Message` union gains `EXTERNAL_BANK_ACCOUNT_INTENT`,
`CONFIRM_EXTERNAL_BANK_ACCOUNT_INTENT`, `EXTERNAL_BANK_ACCOUNT_STATE`,
`EXTERNAL_BANK_ACCOUNT_LINK_TOKEN` and `EXTERNAL_BANK_ACCOUNT_INTENT_RESULT`,
plus `ExternalBankAccountView` and `ExternalBankAccountConfirmResult`, so the
host page and the iframe share one definition of the flow. Note
`requires_verification` is a waiting outcome, not a decline.

Nothing mounts these yet; the host-side component comes next.
