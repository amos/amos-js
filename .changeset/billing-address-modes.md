---
"@amos.com/amos-js": major
---

Restrict `billingAddressRequirement` to `"country" | "full"` (removed `"postalCode"` and `"postalCodeAndCountry"`). Default is now `"country"`. Postal / ZIP is collected only for Canada, Puerto Rico, the United Kingdom, and the United States (labeled ZIP for US).
