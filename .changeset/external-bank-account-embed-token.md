---
"@amos.com/amos-js": minor
---

`mountAmosExternalBankAccountForm` requires `getEmbedToken(intentId)`. The
iframe now reads the intent and mints its Plaid Link token with an embed token
instead of its own API key, which only worked for an intent in that key's
organization. It asks for one before each call over
`EXTERNAL_BANK_ACCOUNT_TOKEN_REQUEST`, and the SDK answers with
`EXTERNAL_BANK_ACCOUNT_TOKEN`, carrying the token or the error from minting it.
