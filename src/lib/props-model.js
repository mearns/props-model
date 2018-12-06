function PropsModel (eventEmitter) {
  this._eventEmitter = eventEmitter
  this._props = {}
}
export default PropsModel

function NOOP () { }

function defaultDidChange (newValue, oldVaue) {
  return newValue !== oldVaue
}

PropsModel.prototype._firePropChangeEvent = function (propName, newValue, oldValue) {
  this._eventEmitter.emit(`${propName}-changed`, propName, newValue, oldValue)
}

/**
 * Define a property that the model will track. An change event for the property is fired unless `didChange`
 * returns a falsey value for the initialValue, where the old value is `undefined`.
 *
 * @param {String} propName The name of the property. An Error will be thrown if the property is already
 * defined.
 * @param {*} initialValue The value to set the property to.
 * @param {function(*, *)} [valueValidator] An optional validator function that will be used whenever the property is set.
 * It is invoked with the new value followed by the old value and is expected to throw an error if and only if the
 * given new value should not be accepted for the property. Otherwise, it can do nothing; the return value is not
 * considered. Note that this is *not* called for the initialValue.
 * @param {function(*, *):boolean} [didChange] An optional function that is called when the property value is set, to determine
 * whether or not the old value and new value should be considered a change. A change even for the property is fired if and only
 * if the function returns a truthy value. The default uses `newValue !== oldValue`.
 */
PropsModel.prototype.defineProp = function (propName, initialValue, valueValidator = NOOP, didChange = defaultDidChange) {
  if (this._props[propName]) {
    throw new Error(`Property already defined: ${propName}`)
  }
  this._props[propName] = {
    value: initialValue,
    derived: false,
    valueValidator,
    didChange
  }
  if (didChange(initialValue, undefined)) {
    this._firePropChangeEvent(propName, initialValue, undefined)
  }
  return this
}

PropsModel.prototype.defineDerivedProp = function (propName, dependsOn = [], _calculateValue, defaultValue, didChange = defaultDidChange) {
  if (this._props[propName]) {
    throw new Error(`Property already defined: ${propName}`)
  }
  const calculateValue = this.createUtilizer(dependsOn, _calculateValue)
  const value = typeof defaultValue === 'undefined' ? calculateValue() : defaultValue
  this._props[propName] = {
    value,
    derived: true,
    valueValidator: () => {},
    didChange
  }
  this._onAny(() => {}, dependsOn, () => { this.set(propName, calculateValue()) })
  if (didChange(value, undefined)) {
    this._firePropChangeEvent(propName, value, undefined)
  }
  return this
}

/**
 * @param {function} propValidator A function that will be called for each property name
 * attempting to be set; it is expected to throw an exception if the property is not allowed
 * to be set. The return value is ignored.
 * @param {...*} args There are two signatures available: provide the property name and
 * value as two arguments, or provide an object whose property names and property values
 * describe what properties you want to set, and how.
 */
PropsModel.prototype._set = function (propValidator, ...args) {
  if (args.length === 1) {
    const propChanges = []
    Object.keys(args[0]).forEach(propName => {
      if (!this._props[propName]) {
        throw new Error(`No such property '${propName}'`)
      }
    })
    Object.keys(args[0]).forEach(propValidator)
    Object.entries(args[0]).forEach(([ propName, value ]) => {
      this._props[propName].valueValidator(value)
    })
    Object.entries(args[0]).forEach(([ propName, value ]) => {
      const oldValue = this._props[propName].value
      this._props[propName].value = value
      if (this._props[propName].didChange(value, oldValue)) {
        propChanges.push([propName, value, oldValue])
      }
    })
    propChanges.forEach(change => this._firePropChangeEvent(...change))
  } else {
    const [propName, value] = args
    if (!this._props[propName]) {
      throw new Error(`No such property '${propName}'`)
    }
    propValidator(propName)
    this._props[propName].valueValidator(value)
    const oldValue = this._props[propName].value
    this._props[propName].value = value
    if (this._props[propName].didChange(value, oldValue)) {
      this._firePropChangeEvent(propName, value, oldValue)
    }
  }
}

PropsModel.prototype._get = function (propValidator, propName) {
  propValidator(propName)
  if (!this._props[propName]) {
    throw new Error(`No such property '${propName}'`)
  }
  return this._props[propName].value
}

PropsModel.prototype._toJSON = function (propChecker) {
  return Object.entries(this._props)
    .filter(([ propName ]) => propChecker(propName))
    .reduce((o, [propName, { value }]) => {
      o[propName] = value
      return o
    }, {})
}

function createAccessorNames (propName, ...prefixes) {
  return prefixes.map(prefix => `${prefix}${propName.replace(/^./, c => c.toUpperCase())}`)
}

/**
 * Adds accessor methods (getters and setters) fo the specified properties as methods on the given target object.
 */
PropsModel.prototype._installAccessors = function (readValidator, writeValidator, target, propertyAccess) {
  for (let propName of Object.keys(propertyAccess)) {
    const access = propertyAccess[propName]
    if (!this._props[propName]) {
      throw new Error(`Cannot create accessors for non-existant property '${propName}'`)
    }
    switch (access.toLowerCase()) {
      case 'readonly':
        readValidator(propName)
        break

      case 'readwrite':
        readValidator(propName)
        writeValidator(propName)
        break

      case 'none':
        break

      default:
        throw new Error(`Unknown access type '${access}' specified for property '${propName}'`)
    }
  }
  for (let propName of Object.keys(propertyAccess)) {
    const access = propertyAccess[propName]
    switch (access.toLowerCase()) {
      case 'readonly':
        const [funcName] = createAccessorNames(propName, 'get')
        const getter = {
          [funcName]: () => {
            return this._props[propName].value
          }
        }[funcName]
        target[funcName] = getter
        break

      case 'readwrite':
        const [getterName, setterName] = createAccessorNames(propName, 'get', 'set')
        const funcs = {
          [getterName]: () => {
            return this._props[propName].value
          },
          [setterName]: (value) => {
            this._set(() => {}, propName, value)
          }
        }
        target[getterName] = funcs[getterName]
        target[setterName] = funcs[setterName]
        break

      default:
        break
    }
  }
}

/**
 * Create a function that will delegate to the given handler with the values of specified properties as the arguments.
 * The returned function will fetch the values of the named properties and pass them in the order given as the first
 * arguments to the given handler function. Any arguments passed to the returned function will be passed as additional
 * arguments to handler.
 *
 * @param {Array<String>} propNames The array of property names you want to utilize
 * @param {function} handler The function that the returned function will delegate to with the values of the specified
 * properties.
 */
PropsModel.prototype._createUtilizer = function (propValidator, [...propNames], handler) {
  propNames.forEach(propValidator)
  propNames.forEach(propName => {
    if (!this._props[propName]) {
      throw new Error(`Cannot create utilizer of unknown property '${propName}'`)
    }
  })
  return (...args) => {
    return handler(
      ...propNames.map(propName => this._props[propName].value),
      ...args
    )
  }
}

/**
 * Register the given handler to be invoked any time any of the given properties fire a change event.
 *
 * The given handler is invoked with three arguments: propName, newValue, oldValue.
 */
PropsModel.prototype._onAny = function (propValidator, [...propNames], handler) {
  propNames.forEach(propValidator)
  for (let i = 0; i < propNames.length; i++) {
    this._eventEmitter.on(`${propNames[i]}-changed`, handler)
  }
}

/**
 * Register the given handler to be called with the values of all of the named properties anytime
 * any one of those properties changes.
 *
 * This uses {@link #_createUtilizer} to create a no-argument function that will collect the
 * values of the properties and delegate them to the given `handler`. The function thus prouced is
 * registered as a change handler for the given properties, and is also returned from this function.
 */
PropsModel.prototype._createChangeHandler = function (propValidator, [...respondsTo], handler) {
  const callback = this._createUtilizer(propValidator, respondsTo, handler)
  this._onAny(() => {}, respondsTo, () => callback())
  return callback
}

PropsModel.prototype.createUtilizer = function (propNames, handler) {
  return this._createUtilizer(() => {}, propNames, handler)
}

PropsModel.prototype.onAny = function (propNames, handler) {
  return this._onAny(() => {}, propNames, handler)
}

/**
 * Like {@link #createUtilizer}, but it also registers the created utilizer function to be called anytime
 * any of the specified properties change. The utilizer function is still returned.
 *
 * @param {Array<String>} respondsTo The array of property names to respond to
 * @param {function} handler The handler to all when ay of the specified properties change
 */
PropsModel.prototype.createChangeHandler = function (respondsTo, handler) {
  return this._createChangeHandler(() => {}, respondsTo, handler)
}

PropsModel.prototype.set = function (...args) {
  return this._set(() => {}, ...args)
}

PropsModel.prototype.get = function (...args) {
  return this._get(() => {}, ...args)
}

PropsModel.prototype.toJSON = function () {
  return this._toJSON(() => true)
}

PropsModel.prototype.installAccessors = function (...args) {
  return this._installAccessors(() => {}, () => {}, ...args)
}

function propertyCheckerToValidator (checker) {
  return propName => {
    const checkResult = checker(propName)
    if (checkResult instanceof Error) {
      throw checkResult
    } else if (!checkResult) {
      throw new Error(`Requested access to property '${propName}' is not allowed`)
    }
  }
}
/**
 * Create an API object that provides limited access to this model defined by the given checkers and validators.
 *
 * @param {function(String):boolean|function(String):Error} readChecker A function to determine whether or not the API should have
 * read access to a given property name. Invoked with a property name, it should return a non-Error truthy value if the API
 * should have read access to the property, and either a falsey value or an Error object if not.
 * @param {function(String):*} [readValidator] A function to enforce read access; it is invoked with a property name and should
 * throw an Error if and only if the API should not have read access to the named property. The return value is ignored. If this
 * argument is not provided, a default is derived from the `readChecker`.
 * @param {function(String):*} [writeValidator=readValidator] A function to enforce write access, similar to the `readValidator`.
 * If not given, the default is to use the `readValidator`.
 *
 * @returns {{get, set, createUtilizer, createChangeHandler, toJSON}}
 */
PropsModel.prototype.createApi = function (readChecker, readValidator = propertyCheckerToValidator(readChecker), writeValidator = readValidator) {
  return {
    get: (...args) => this._get(readValidator, ...args),
    set: (...args) => this._set(writeValidator, ...args),
    createUtilizer: (...args) => this._createUtilizer(readValidator, ...args),
    createChangeHandler: (...args) => this._createChangeHandler(readValidator, ...args),
    installAccessors: (...args) => this._installAccessors(readValidator, writeValidator, ...args),
    toJSON: () => this._toJSON(readChecker)
  }
}

function propNameIsPublic (propName) {
  return !propName.startsWith('_')
}

function assertPropNameIsPublic (propName) {
  if (!propNameIsPublic(propName)) {
    throw new Error(`Property is not publicly accessible: ${propName}`)
  }
}

function createStandardWriteValidator (propModel) {
  return propName => {
    if (propModel._props[propName].derived) {
      throw new Error(`Write access to ${propName} is not allowed because the property is a derived property.`)
    }
  }
}

/**
 * Returns an API object that has read access to all public properties, and write access to all public
 * properties that are not derived.
 *
 * Public properties are those whose name does not begin with an underscore
 *
 * @see #createApi
 */
PropsModel.prototype.getStandardPublicApi = function () {
  const standardWriteValidator = createStandardWriteValidator(this)
  return this.createApi(propNameIsPublic, assertPropNameIsPublic, propName => {
    assertPropNameIsPublic(propName)
    standardWriteValidator(propName)
  })
}

/**
 * Returns an API object that allows read access to all properties, and write access
 * to all non-derived properties.
 *
 * This is typically the API used by the property owner itself, to ensure you aren't
 * trying to write to derived properties, which is usually not recommended.
 */
PropsModel.prototype.getStandardPrivateApi = function () {
  return this.createApi(() => true, () => {}, createStandardWriteValidator(this))
}
