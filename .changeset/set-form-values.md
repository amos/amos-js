---
"@amos.com/amos-js": patch
---

Add `setFormValues` so hosts can push non-PCI billing fields (postal code, country, address) into the card/bank iframe without remounting. PAN, CVC, expiration, and bank numbers are not part of this API.
