# @amos.com/amos-js

## 0.11.17

### Patch Changes

- Add Plaid skeleton

## 0.11.16

### Patch Changes

- Distinguish timeout from decline

## 0.11.15

### Patch Changes

- Autoreload, appearance font and rules

## 0.11.14

### Patch Changes

- Prevent 307s and force iframe reloading if needed

## 0.11.13

### Patch Changes

- Support older browsers

## 0.11.12

### Patch Changes

- Load payment iframes from `https://js.amos.com` (production) and `https://js-sandbox.amos.com` (sandbox). Add those origins to CSP `frame-src` and `Permissions-Policy payment=` before upgrading. Older SDK versions continue to use `embed.amos.com` / `embed-sandbox.amos.com`.

## 0.11.11

### Patch Changes

- Keep Apple Pay waiting until confirm

## 0.11.10

### Patch Changes

- Propagate escape key press

## 0.11.9

### Patch Changes

- Propagate form submit

## 0.11.8

### Patch Changes

- Bump @amos.com/node

## 0.11.7

### Patch Changes

- Bump @amos.com/node

## 0.11.6

### Patch Changes

- Populate and focus form fields

## 0.11.5

### Patch Changes

- Restore intent responses

## 0.11.4

### Patch Changes

- Use embedded Plaid

## 0.11.3

### Patch Changes

- Remove deprecated code

## 0.11.2

### Patch Changes

- Update dependencies

## 0.11.1

### Patch Changes

- Handle sync authorization

## 0.10.6

### Patch Changes

- Improve postMessage flow

## 0.10.5

### Patch Changes

- Revert debug

## 0.10.2

### Patch Changes

- Handle render token verification settings

## 0.10.1

### Patch Changes

- Require amount for bank account form

## 0.10.0

### Minor Changes

- Add onCardBrandChanged so hosts can react when the credit-card iframe detects Visa, Mastercard, Amex, Discover, Diners Club, or JCB.

## 0.9.18

### Patch Changes

- Support Plaid

## 0.9.17

### Patch Changes

- Add Google Pay/Apple Pay skeleton

## 0.9.16

### Patch Changes

- Improve comments

## 0.9.15

### Patch Changes

- Breaking API changes

## 0.9.14

### Patch Changes

- Add appearance variables

## 0.9.13

### Patch Changes

- Styling improvements

## 0.9.12

### Patch Changes

- Add form skeleton

## 0.9.11

### Patch Changes

- Add onValidityChange

## 0.9.10

### Patch Changes

- Forward props to Apple Pay and Google Pay

## 0.9.9

### Patch Changes

- Add appearance variables

## 0.9.8

### Patch Changes

- Add appearance variables

## 0.9.7

### Patch Changes

- Update amos-node

## 0.9.6

### Patch Changes

- Move @amos.com/node to peer dependency

## 0.9.5

### Patch Changes

- Add resetForm API. Restrict postMessage origin.

## 0.9.4

### Patch Changes

- Fix SVG

## 0.9.3

### Patch Changes

- Update amos-node

## 0.9.2

### Patch Changes

- Add `reason` on `status: "incomplete"` (`field_errors` | `validation_failed`) so hosts can distinguish recoverable iframe states.
- Ignore `postMessage` events from windows other than the mounted iframe (`event.source` check on card/bank and Google Pay listeners).
- Fix `ConfirmationResult` JSDoc to match the `incomplete` behavior.

## 0.8.1

### Patch Changes

- Update amos-node and other dependencies

## 0.9.0

### Minor Changes

- Replace confirmation success/failure callbacks and messages with a single `CONFIRMATION_RESULT` / `onResult` flow. Recoverable field validation stays in the iframe (`status: "incomplete"`); verify settlement via webhooks.

## 0.7.2

### Patch Changes

- Update amos-node

## 0.7.1

### Patch Changes

- Show Apple Pay overlay

## 0.7.0

### Minor Changes

- Drop Apple Pay iframe expand/collapse (`EXPAND_IFRAME` / `COLLAPSE_IFRAME`) and `UPDATE_NATIVE_APPLE_PAY_SESSION` / `hasNativeApplePaySession`. QR handoff uses Apple's popup (`renderApplePayCodeAs: "window"`).

### Patch Changes

- 764dbec: Refactor Apple Pay

## 0.6.1

### Patch Changes

- Detect native `ApplePaySession` on the parent (`UPDATE_NATIVE_APPLE_PAY_SESSION` / `hasNativeApplePaySession`) so the embed expands only for Chrome's in-iframe QR handoff.

## 0.6.0

### Minor Changes

- Keep Apple Pay button/session in the Amos embed iframe (Amos-only Apple domain registration). Expand the iframe to a full-viewport overlay on EXPAND_IFRAME so Chrome's QR handoff UI is not clipped; restore on COLLAPSE_IFRAME.

## 0.5.0

### Minor Changes

- Add mountAmosApplePayButton for Apple Pay express checkout

## 0.4.1

### Patch Changes

- Restrict `billingAddressRequirement` to `"country" | "full"` (removed `"postalCode"` and `"postalCodeAndCountry"`). Default is now `"country"`. Postal / ZIP is collected only for Canada, Puerto Rico, the United Kingdom, and the United States (labeled ZIP for US).

## 0.4.0

### Minor Changes

- Support billingAddressRequirement option

## 0.3.24

### Patch Changes

- Update amos-node

## 0.3.23

### Patch Changes

- Update amos-node

## 0.3.22

### Patch Changes

- Update amos-node

## 0.3.21

### Patch Changes

- Update amos-node

## 0.3.20

### Patch Changes

- Add input font size variable

## 0.3.19

### Patch Changes

- Update amos-node

## 0.3.18

### Patch Changes

- Update amos-node and clean up types

## 0.3.17

### Patch Changes

- Update amos-node

## 0.3.16

### Patch Changes

- Update amos-node

## 0.3.15

### Patch Changes

- Update amos-node

## 0.3.14

### Patch Changes

- Update amos-node

## 0.3.13

### Patch Changes

- Update amos-node

## 0.3.12

### Patch Changes

- 34ab73d: Bump @amos.com/node dependency.

## 0.3.11

### Patch Changes

- Fix build

## 0.3.10

### Patch Changes

- Fix build

## 0.3.9

### Patch Changes

- Update amos-node and dependencies

## 0.3.8

### Patch Changes

- Bump @amos.com/node dependency.

## 0.3.7

### Patch Changes

- Bump @amos.com/node dependency.

## 0.3.6

### Patch Changes

- Bump @amos.com/node dependency.

## 0.3.5

### Patch Changes

- Bump @amos.com/node dependency.

## 0.3.4

### Patch Changes

- Update amos-node

## 0.3.3

### Patch Changes

- Update amos-node

## 0.3.2

### Patch Changes

- Update amos-node

## 0.3.1

### Patch Changes

- Update README

## 0.3.0

### Minor Changes

- Support label placement config

## 0.2.0

### Minor Changes

- Add css variables for appearance API

## 0.1.2

### Patch Changes

- Update package.json

## 0.1.1

### Patch Changes

- Update README
