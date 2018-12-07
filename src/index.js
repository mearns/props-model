/**
 * The main module for this package, it exports the {@link PropsModel} class.
 *
 * When used as an ES6 module, you can import as either the default import, or the named 'PropsModel' import, e.g.:
 *
 * ```javascript
 * import PropsModel from 'props-model'
 * // or, as a named import:
 * import { PropsModel } from 'props-model'
 * ```
 *
 * When using with node's `require` function, use the `PropsModel` property of the import, e.g.:
 * ```javascript
 * const PropsModel = require('props-model').PropsModel
 * // or, with destructuring assignment:
 * const { PropsModel } = require('props-model')
 * ```
 *
 * @see {@link PropsModel}
 * @module props-model
 */
import { PropsModel as _PropsModel } from './lib/props-model'

/**
 * The named 'PropsModel' export for the module, which is the same as the default export.
 *
 * @static
 * @type {Constructor}
 * @see {@link PropsModel}
 */
export const PropsModel = _PropsModel

export default PropsModel
