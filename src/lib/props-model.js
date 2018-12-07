/**
 * Instances of this class are used to configure and manage a set of named properties.
 * Properties can have their values set and retrieved, and they fire change events through
 * the given [EventEmitter]{@link external:EventEmitter} when the values change.
 *
 * Each property has a unique name, defined by a string. Properties can either be _primary_ or
 * _derived_. A **primary** property is one that you have to set a value for explicitly. A **derived**
 * property is calcuated automatically from the values of other properties (either primary or derived).
 * Derived properties are registered as change-listeners to all the properties they are calculated
 * from, so that they are automatically updated when any of their dependencies change. Derived properties
 * likewise fire property change events when their value changes.
 *
 * @extends PropsModelApi
 */
export class PropsModel {
  /**
   * @param {external:EventEmitter} eventEmitter The event emitter on which property change events will be
   * emitted and listened to.
   */
  constructor (eventEmitter) {
    this._eventEmitter = eventEmitter
    this._props = {}
  }

  /**
   * Helper method that is used to fire a property change event. This should be called *after* the properties
   * value has been updated. Also note that the standard [EventEmitter]{@link external:EventEmitter} fires events
   * and triggers listeners synchronously, so this won't return until all listeners have acted. This could lead
   * to a deep call stack if those listeners end up updating other properties, and so on.
   *
   * @private
   * @param {string} propName The name of hte property which has changed.
   * @param {*} newValue The new value of the property.
   * @param {*} oldValue The previous value of the property.
   */
  _firePropChangeEvent (propName, newValue, oldValue) {
    this._eventEmitter.emit(`${propName}-changed`, propName, newValue, oldValue)
  }

  /**
   * Define a primary property that the model will track. It's value is set to the `initialValue`, which counts as setting
   * the value of the property, changing it from `undefined`, so a change event for the property is fired unless `didChange`
   * returns a falsey value for the change.
   *
   * @param {string} propName The name of the property. An Error will be thrown if the property is already defined.
   *
   * @param {*} initialValue The value to set the property to.
   *
   * @param {valueValidator} [valueValidator] An optional validator function that will be used whenever the property is set.
   * The default allows all values. **Note** that this is _not_ called for the initial value, it's up to you to ensure that
   * the initial value is valid.
   *
   * @param {didChange} [didChange] An optional function that is called anytime the property value is set, to determine
   * whether or not the old value and new value should be considered a change. A change event for the property is fired if and only
   * if the function returns a truthy value. The default uses `newValue !== oldValue`. Note that the property value is changed
   * regardless of what this function returns, it is only used to determine if the event should be fired.
   */
  defineProp (propName, initialValue, valueValidator = NOOP, didChange = defaultDidChange) {
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

  /**
   * Defines a derived property which is set and updated automatically based on the values other specified properties.
   *
   * @param {string} propName The name of the property to define. An error will be thrown if the property already exists.
   * @param {Array<string>} dependsOn The list of property names that this derived property depends on. Note that
   * derived properties can only depend on already existing properties, and the dependencies of a derived property cannot
   * be changed once set, so it is not possible to create cycles of dependent properties.
   * @param {function(...*):*} calculateValue A function that will be invoked as needed to calculate the value of this
   * property. It is invoked immediately to set the initial value (unless `initialValue` is given), and invoked again
   * anytime one of the specified properties fires a change event. It is invoked with the contemporary values of the
   * named properties, each passed as a separate arg, in the order specified in `dependsOn`.
   * @param {*} [initialValue] An optional initial value to use, _in place of_ calculating the value. This will
   * be used unless it has a `typeof` equal to `'undefined'`.
   * @param {didChange} [didChange] An optional function to determine if a new value for the property should be
   * considered a change from its previous value. See the same parameter on [`defineProp`]{@link PropsModel#defineProp}.
   */
  defineDerivedProp (propName, dependsOn = [], _calculateValue, initialValue, didChange = defaultDidChange) {
    if (this._props[propName]) {
      throw new Error(`Property already defined: ${propName}`)
    }
    const calculateValue = this.createUtilizer(dependsOn, _calculateValue)
    const value = typeof initialValue === 'undefined' ? calculateValue() : initialValue
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
   * Set one or more properties. You won't typically call this directly, you would use it through
   * the [set()]{@link PropsModelApi#set} method.
   *
   * @private
   * @param {propValidator} propValidator Called to verify write access to each property attempting
   * to be set.
   * @param {...*} args There are two signatures available: provide the property name and
   * value as two arguments, or provide an object whose property names and property values
   * describe what properties you want to set, and how. See {@link PropsModelApi#set(1)}
   * and {@link PropsModelApi#set(2)}.
   */
  _set (propValidator, ...args) {
    if (args.length === 1) {
      Object.keys(args[0]).forEach(propName => {
        if (!this._props[propName]) {
          throw new Error(`No such property '${propName}'`)
        }
      })
      Object.keys(args[0]).forEach(propValidator)
      Object.entries(args[0]).forEach(([ propName, value ]) => {
        this._props[propName].valueValidator(value)
      })
      const oldValues = []
      Object.entries(args[0]).forEach(([ propName, value ]) => {
        oldValues.push(this._props[propName].value)
        this._props[propName].value = value
      })
      Object.entries(args[0]).forEach(([ propName, value ], idx) => {
        const oldValue = oldValues[idx]
        if (this._props[propName].didChange(value, oldValue)) {
          this._firePropChangeEvent(propName, value, oldValue)
        }
      })
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

  _get (propValidator, propName) {
    propValidator(propName)
    if (!this._props[propName]) {
      throw new Error(`No such property '${propName}'`)
    }
    return this._props[propName].value
  }

  _toJSON (propChecker) {
    return Object.entries(this._props)
      .filter(([ propName ]) => propChecker(propName))
      .reduce((o, [propName, { value }]) => {
        o[propName] = value
        return o
      }, {})
  }

  /**
   * Adds accessor methods (getters and setters) fo the specified properties as methods on the given target object.
   */
  _installAccessors (readValidator, writeValidator, target, propertyAccess) {
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
   * @param {Array<string>} propNames The array of property names you want to utilize
   * @param {function} handler The function that the returned function will delegate to with the values of the specified
   * properties.
   */
  _createUtilizer (propValidator, [...propNames], handler) {
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
  _onAny (propValidator, [...propNames], handler) {
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
  _createChangeHandler (propValidator, [...respondsTo], handler) {
    const callback = this._createUtilizer(propValidator, respondsTo, handler)
    this._onAny(() => {}, respondsTo, callback)
    return callback
  }

  createUtilizer (propNames, handler) {
    return this._createUtilizer(() => {}, propNames, handler)
  }

  onAny (propNames, handler) {
    return this._onAny(() => {}, propNames, handler)
  }

  /**
   * Like {@link #createUtilizer}, but it also registers the created utilizer function to be called anytime
   * any of the specified properties change. The utilizer function is still returned.
   *
   * @param {Array<string>} respondsTo The array of property names to respond to
   * @param {function} handler The handler to all when ay of the specified properties change
   */
  createChangeHandler (respondsTo, handler) {
    return this._createChangeHandler(() => {}, respondsTo, handler)
  }

  set (...args) {
    return this._set(() => {}, ...args)
  }

  get (...args) {
    return this._get(() => {}, ...args)
  }

  toJSON () {
    return this._toJSON(() => true)
  }

  installAccessors (...args) {
    return this._installAccessors(() => {}, () => {}, ...args)
  }

  /**
   * Create an API object that provides limited access to this model defined by the given checkers and validators.
   *
   * @param {function(string):boolean|function(string):Error} readChecker A function to determine whether or not the API should have
   * read access to a given property name. Invoked with a property name, it should return a non-Error truthy value if the API
   * should have read access to the property, and either a falsey value or an Error object if not.
   * @param {function(string):*} [readValidator] A function to enforce read access; it is invoked with a property name and should
   * throw an Error if and only if the API should not have read access to the named property. The return value is ignored. If this
   * argument is not provided, a default is derived from the `readChecker`.
   * @param {function(string):*} [writeValidator=readValidator] A function to enforce write access, similar to the `readValidator`.
   * If not given, the default is to use the `readValidator`.
   *
   * @returns {{get, set, createUtilizer, createChangeHandler, toJSON}}
   */
  createApi (readChecker, readValidator = propertyCheckerToValidator(readChecker), writeValidator = readValidator) {
    return {
      get: (...args) => this._get(readValidator, ...args),
      set: (...args) => this._set(writeValidator, ...args),
      createUtilizer: (...args) => this._createUtilizer(readValidator, ...args),
      createChangeHandler: (...args) => this._createChangeHandler(readValidator, ...args),
      installAccessors: (...args) => this._installAccessors(readValidator, writeValidator, ...args),
      toJSON: () => this._toJSON(readChecker)
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
  getStandardPublicApi () {
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
  getStandardPrivateApi () {
    return this.createApi(() => true, () => {}, createStandardWriteValidator(this))
  }
}

function NOOP () { }

function defaultDidChange (newValue, oldVaue) {
  return newValue !== oldVaue
}

function createAccessorNames (propName, ...prefixes) {
  return prefixes.map(prefix => `${prefix}${propName.replace(/^./, c => c.toUpperCase())}`)
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
 * Handles emitting and subscribing to events. Used for handling property change events by the {@link PropsModel}.
 * @external EventEmitter
 * @type {Constructor}
 * @see https://nodejs.org/api/events.html#events_class_eventemitter
 */

/**
 * A function that can be defined for each primary property to determine whether or not the property can
 * be set to a given value. The value is considered valid unless the validator throws.
 *
 * Any return value is ignored.
 *
 * @callback valueValidator
 * @param {*} incomingValue The value we want to set the property to.
 * @throws {*} If the function throws anything, the incoming value is considered invalid and the property
 * value will not be set, nor will a property change event be fired for it.
 */

/**
 * A function that is used to determine if a property should be considered to have changed, given the
 * old and new values. This is used to determine whether or not property change event will be fired.
 *
 * This is useful if you have multiple valid ways to represent the same canonical value, and don't
 * want to cfire a change event unnecessarily. For instance, if the value of the property is an object,
 * then two different objects which have all the same contents _might_ be considered equivalent and
 * not treated as a change.
 *
 * **NB**: Keep in mind that non-primitive property values can be changed out from under you by anyone
 * who still has a reference to it. So even though an object or array might look the same as the current
 * value when it's passed in, that doesn't mean it will remain the same.
 *
 * @callback didChange
 * @param {*} newValue The new value of the property, to which it was changed.
 * @param {*} prevValue The previous value of the property, from which it was changed.
 * @return {boolean} Any truthy value will indicate that the property should be considered changed.
 */

/**
 * A generic validator that is typically used to enforce access authorization for properties based
 * on their names.
 *
 * @callback propValidator
 * @param {string} propName The name of the property
 * @throws {*} Throw an error if the property name is not valid for the appropriate task.
 */

/**
 * A common interface for manipulating and using (but not defining) properties.
 * The {@link PropsModel} class implements this interface, it also provides methods for
 * getting other implementations of this interface for various access limitations.
 * See, for instance, {@link PropsModel#createApi}.
 *
 * @interface PropsModelApi
 */

/**
 * Set a single property to a new value. The given value will be passed to the configured {@link valueValidator}
 * for the property, _before_ the property is set; if the validator throws an error, the error will not be
 * caught, and the property will not be updated.
 *
 * After the value is updated, its configured {@link didChange} function will be called and a change event
 * will be fired unless `didChange` returns a falsey value.
 *
 * @method set(1)
 * @inner
 * @memberof PropsModelApi
 * @param {string} propName The name of the property
 * @param {*} value The new value.
 */

/**
 * Atomically set multiple properties at once. See [`set(string, *)`]{@link PropsModelApi#set(1)} for general information.
 * This variant sets all the properties specified as keys to the given `propValues` object, setting each
 * to the corresponding value. Note that all properties and values are validated _before_ any property
 * is changed. This includes ensuring that the property is accessible for the given API, that the property
 * exists, and that the value is valid according to the property's {@link valueValidator}.
 *
 * Additionally, all properties are updated _before_ any property change events are fired. Events are fired
 * individually for each property, in the order they iterate from `propVaues`, and subject to that properties
 * {@link didChange} function.
 *
 * @method set(2)
 * @inner
 * @memberof PropsModelApi
 * @param {object} propValues An object mapping property names to the values you want to set them to.
 * All own-properties of the object are assumed to be property names you want to set.
 */

/**
 * Get the value of the named property. Throws an error if the property does not exist or the
 * API doesn't have read access to it.
 *
 * @method get
 * @inner
 * @memberof PropsModelApi
 * @param {string} propName The name of the property to get
 * @returns {*} The value of the named property.
 */

/**
 * Create a "utilizer function" that makes use of the values of all the named properties.
 *
 * @method createUtilizer
 * @inner
 * @memberof PropsModelApi
 * @param {Array<string>} propNames A list of property names that the utilizer will use.
 * @param {function(...*):*} handler The function that the returned utilizer function will
 * delegate to, invoked with the contemporary values of the named properties, each passed
 * as an individual argument, in the same order they're given in `propNames`. Any arguments passed
 * to the utlizer function will be also be passed, following the property values.
 *
 * @throws {Error} If any of the named properties either don't exist or aren't accessible to the
 * API at the time this funciton is called.
 *
 * @returns {function(...args):*} Returns a "utilizer" function, which can be invoked to get the
 * values of the properties named by `propNames` and pass them to the given `handler` function,
 * along with any args passed to the utilizer function. The utilizer function delegates to
 * the `handler` at that point, returning whatever value it returns.
 */

/**
 * Register the given `handler` to be called anytime one of the properties specified by `propNames`
 * fires a change event. The `handler` is invoked with the current values of all the specified
 * properties, followed by the standard change-event listener arguments: propertyName, newValue, oldValue
 * for the property that was changed. Note that there is _no aggregation_ of change events, so it
 * something changes multiple properties at once, the handler will be invoked for each property change.
 *
 * This actually uses [createUtilizer()]{@link PropsModelApi~createUtilizer} to create and returns a utilizer function, after registering
 * the utilizer for the change events.
 *
 * @method createChangeHandler
 * @inner
 * @memberof PropsModelApi
 * @param {Array<string>} propNames A list of property names that the utilizer will use.
 * @param {function(...*):*} handler The function that the returned utilizer function will
 *
 * @throws {Error} If any of the named properties either don't exist or aren't accessible to the
 * API at the time this funciton is called.
 *
 * @returns {function(...args):*} Returns a "utilizer" function, which can be invoked to get the
 * values of the properties named by `propNames` and pass them to the given `handler` function,
 * along with any args passed to the utilizer function. The utilizer function delegates to
 * the `handler` at that point, returning whatever value it returns.
 */

/**
 * Creates accessor functions (getter and/or setters) for specific properties and attaches them
 * as methods to the given `target` object. This is a usefull way to create a bean-type
 * interface for your properties.
 *
 * Accessor function names (and the property names with which they attach to target) take the form
 * "get${PropName}" for getters and "set${PropName}" for setters, where `${PropName}` is simply the
 * properties name with the first character capitalized.
 *
 * @method installAccessors
 * @inner
 * @memberof PropsModelApi
 * @param {object} target The object onto which the accessor methods will be attached as properties.
 * @param {object} propertyAccess An object describing which properties to create accessors for, and
 * what accessors to create. Each own-property of the object is the name of a property, and the corresponding
 * property value should be one of `'readonly'`, `'readwrite'`, or `'none'`, to create a getter only,
 * a getter and a setter, or no accessors, respectively. The `'none'` value is only to be explicit, if
 * the property is not included in the object, no accessors will be created for it. Any other property
 * values will cause an error, as will properties of this object which do not correspond to known property
 * names or which correspond to properties the API doesn't have appropriate access to.
 */

/**
 * Returns an object representing the properties and their current values that this API has
 * read access to.
 *
 * @method toJSON
 * @inner
 * @memberof PropsModelApi
 */
