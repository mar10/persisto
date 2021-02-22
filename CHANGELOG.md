# 2.0.0-0 / Unreleased
  * Rewritten in TypeScript
  * Drop dependency on jQuery
  * Drop support for IE
  * Use typedoc for API documetation
  * [ADD] `attachForm` option

# 1.3.1-0 / Unreleased

# 1.3.0 / 2020-09-11
  * [Changed] jQuery is now a peerDependency (>=1.12), so users can install or
    re-use their own version.
  * [FIX] #3: `writeToForm()` skips input elements of type 'file', because setting
    these values would raise an exception.
  * [FIX] #6: `writeToForm()` handles complex input names.
  * Update to jQuery 3.5.1 and Qunit 2.11

# 1.2.0 / 2019-09-07
  * [ADD] AMD wrapper and module support (`persisto = require('persisto')`).
  * [CHANGE] Apply and enforce 'prettier' codestyle

# 1.1.0 / 2016-08-14
  * [CHANGE] Rename `.init` option to `.defaults`.
  * [CHANGE] Rename `.debug` option to `.debugLevel`.

# 1.0.0 / 2016-08-11
  * [ADD] .set() creates intermediate objects if missing.
  * [ADD] .writeToForm() and .readFromForm() accept inputs with nested names.
  * [FIX] .remove() supports dot notation.

# 0.0.1 / 2016-04-10
  * Initial release.
