# 1.2.1-0 / Unreleased
  * [Changed] jQuery is now a peerDependency (>=1.12), so users can install or
    re-use their own version.
  * [FIX] #3: `writeToForm()` skips input elements of type 'file', because setting
    these values would raise an exception.

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
