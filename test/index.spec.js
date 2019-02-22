/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

// Module under test
import PropsModel, { PropsModel as NamedImport } from '../src'

// Support modules
import chai, { expect } from 'chai'
import EventEmitter from 'events'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'

chai.use(sinonChai)

describe('The props-model package', () => {
  describe('import options', () => {
    const requiredModule = require('../src')
    ;[
      ['required(\'props-model\').default', requiredModule.default],
      ['required(\'props-model\').PropsModel', requiredModule.PropsModel],
      ['named import', NamedImport]
    ].forEach(([description, Uut]) => {
      it(`should work as expected when imported as ${description}`, () => {
        expect(Uut).to.be.a('function')
        expect(Uut).to.haveOwnProperty('name').which.equals('PropsModel')
        const instance = new Uut()
        expect(instance).to.be.instanceOf(PropsModel)
      })
    })
  })

  it('Should initialize a newly defined prop to the given initial value', () => {
    // given
    const initialValue = 314158
    const propModel = new PropsModel(new EventEmitter())
    propModel.defineProp('foo1', initialValue)

    // expect
    expect(propModel.get('foo1')).to.equal(initialValue)
  })

  it('should allow a value to be updated through the set method', () => {
    // given
    const initialValue = 314158
    const newValue = 2 * initialValue + 1717
    const propModel = new PropsModel(new EventEmitter())
    propModel.defineProp('foo1', initialValue)

    // when
    propModel.set('foo1', newValue)

    // expect
    expect(propModel.get('foo1')).to.equal(newValue)
  })

  it('should fire an event when the property is defined', () => {
    // given
    const initialValue = 314158
    const emitter = new EventEmitter()
    const propModel = new PropsModel(emitter)
    const changeListener = sinon.spy()
    emitter.on('foo1-changed', changeListener)

    // when
    propModel.defineProp('foo1', initialValue)

    // expect
    expect(changeListener).to.have.been.calledWith('foo1', initialValue, undefined)
  })

  it('should fire an event with the prop name and the new and old values when the value is changed from the initial value', () => {
    // given
    const initialValue = 314158
    const newValue = 2 * initialValue + 1717
    const emitter = new EventEmitter()
    const propModel = new PropsModel(emitter)
    const changeListener = sinon.spy()
    propModel.defineProp('foo1', initialValue)

    // when
    emitter.on('foo1-changed', changeListener)
    propModel.set('foo1', newValue)

    // expect
    expect(changeListener).to.have.been.calledWith('foo1', newValue, initialValue)
  })

  it('should fire an event with the prop name and the new and old values when the value is changed from a non-initial value', () => {
    // given
    const initialValue = 314158
    const secondValue = 2 * initialValue + 1717
    const thirdValue = secondValue % 177
    const emitter = new EventEmitter()
    const propModel = new PropsModel(emitter)
    const changeListener = sinon.spy()
    propModel.defineProp('foo1', initialValue)
    propModel.set('foo1', secondValue)

    // when
    emitter.on('foo1-changed', changeListener)
    propModel.set('foo1', thirdValue)

    // expect
    expect(changeListener).to.have.been.calledWith('foo1', thirdValue, secondValue)
  })

  it('should throw an error, not change the value, and not fire a change event if the valueValidator throws on set', () => {
    // given
    const initialValue = 314158
    const secondValue = 2 * initialValue + 1717
    const emitter = new EventEmitter()
    const propModel = new PropsModel(emitter)
    propModel.defineProp('foo1', initialValue, () => { throw new Error('Test Error') })
    const changeListener = sinon.spy()
    emitter.on('foo1-changed', changeListener)

    // expect
    expect(() => propModel.set('foo1', secondValue)).to.throw('Test Error')
    expect(changeListener).to.not.have.been.called
    expect(propModel.get('foo1')).to.equal(initialValue)
  })

  it('should not throw an error if the initial value does not pass the valueValidator', () => {
    const initialValue = 314158
    const emitter = new EventEmitter()
    const propModel = new PropsModel(emitter)

    // expect
    expect(() => propModel.defineProp('foo1', initialValue, () => { throw new Error('Test Error') })).to.not.throw
  })

  it('should not fire a change event if the didChange function returns false on definition', () => {
    // given
    const initialValue = 314158
    const emitter = new EventEmitter()
    const changeListener = sinon.spy()
    emitter.on('foo1-changed', changeListener)

    const propModel = new PropsModel(emitter)
    propModel.defineProp('foo1', initialValue, () => { }, () => false)

    // expect
    expect(changeListener).to.not.have.been.called
  })

  it('should not fire a change event if the didChange function returns false on an update', () => {
    // given
    const initialValue = 314158
    const secondValue = 2 * initialValue + 1717
    const emitter = new EventEmitter()
    const changeListener = sinon.spy()
    emitter.on('foo1-changed', changeListener)

    const propModel = new PropsModel(emitter)
    propModel.defineProp('foo1', initialValue, () => { }, (newValue, oldValue) => typeof oldValue === 'undefined')

    // when
    propModel.set('foo1', secondValue)

    // expect
    expect(changeListener).to.have.been.calledOnce
  })

  it('should use the given initial value for a derive property', () => {
    // given
    const initialValue = 314158
    const defaultDerivedValue = 2 * initialValue + 1717
    const anotherValue = defaultDerivedValue + 15
    const emitter = new EventEmitter()
    const propModel = new PropsModel(emitter)

    propModel.defineProp('foo1', initialValue)

    // when
    propModel.defineDerivedProp('bar', ['foo1'], () => anotherValue, defaultDerivedValue)

    // then
    expect(propModel.get('bar')).to.equal(defaultDerivedValue)
  })

  it('should calculate the value of a derived property on definition when the default value is not given', () => {
    // given
    const initialValue = 314158
    const calculator = foo1 => 2 * foo1
    const emitter = new EventEmitter()
    const propModel = new PropsModel(emitter)

    propModel.defineProp('foo1', initialValue)

    // when
    propModel.defineDerivedProp('bar', ['foo1'], calculator)

    // then
    expect(propModel.get('bar')).to.equal(2 * initialValue)
  })

  it('should update the value of a derived property and fire a change event whenever the property it depends on changes', () => {
    // given
    const initialValue = 314158
    const secondValue = initialValue * 2 + 707
    const calculator = foo1 => 2 * foo1
    const emitter = new EventEmitter()
    const onChangeSpy = sinon.spy()
    const propModel = new PropsModel(emitter)

    propModel.defineProp('foo1', initialValue)
    propModel.defineDerivedProp('bar', ['foo1'], calculator)

    // when
    emitter.on('bar-changed', onChangeSpy)
    propModel.set('foo1', secondValue)

    // then
    expect(propModel.get('bar')).to.equal(2 * secondValue)
    expect(onChangeSpy).to.have.been.calledOnce
    expect(onChangeSpy).to.have.been.calledWith('bar', 2 * secondValue, 2 * initialValue)
  })

  it('should update the value of a derived property and fire a change event whenever the property it depends on changes', () => {
    // given
    const initialValue = 314158
    const secondValue = initialValue * 2 + 707
    const calculator = foo1 => 2 * foo1
    const emitter = new EventEmitter()
    const onChangeSpy = sinon.spy()
    const propModel = new PropsModel(emitter)

    propModel.defineProp('foo1', initialValue)
    propModel.defineDerivedProp('bar', ['foo1'], calculator)

    // when
    emitter.on('bar-changed', onChangeSpy)
    propModel.set('foo1', secondValue)

    // then
    expect(propModel.get('bar')).to.equal(2 * secondValue)
    expect(onChangeSpy).to.have.been.calledOnce
    expect(onChangeSpy).to.have.been.calledWith('bar', 2 * secondValue, 2 * initialValue)
  })

  it('should update the value of a derived property when multiple properties it depends on change', () => {
    // given
    const calculator = (foo1, foo2, foo3) => (31 * foo1) + (37 * foo2) + (41 * foo3)
    const emitter = new EventEmitter()
    const propModel = new PropsModel(emitter)

    propModel.defineProp('foo1', 1)
    propModel.defineProp('foo2', 2)
    propModel.defineProp('foo3', 3)
    propModel.defineDerivedProp('bar', ['foo1', 'foo2', 'foo3'], calculator)

    // when
    propModel.set({
      foo1: 11,
      foo2: 9,
      foo3: 4
    })

    // then
    expect(propModel.get('bar')).to.equal(calculator(11, 9, 4))
  })

  it('should create a property utilizer function that gets the current values of the property', () => {
    // given
    const emitter = new EventEmitter()
    const propModel = new PropsModel(emitter)
    const handler = (foo1, foo2, a1, a2, a3) => [foo1, foo2, a1, a2, a3]

    propModel.defineProp('foo1', 1)
    propModel.defineProp('foo2', 2)
    const utilizer = propModel.createUtilizer(['foo1', 'foo2'], handler)

    // then
    expect(utilizer()).to.deep.equal([1, 2, undefined, undefined, undefined])

    // when
    propModel.set('foo1', 10)
    propModel.set('foo2', 'bar')

    // then
    expect(utilizer('a1', 'my a2')).to.deep.equal([10, 'bar', 'a1', 'my a2', undefined])
  })

  it('should create an on-change handler that is triggered by any change to the dependencies', () => {
    // given
    const emitter = new EventEmitter()
    const propModel = new PropsModel(emitter)
    const handler = sinon.spy()

    propModel.defineProp('foo1', 1)
    propModel.defineProp('foo2', 2)
    propModel.createChangeHandler(['foo1', 'foo2'], handler)

    // when
    propModel.set('foo1', 10)
    propModel.set('foo2', 'bar')

    // then
    expect(handler).to.have.been.calledWith(10, 2)
    expect(handler).to.have.been.calledWith(10, 'bar')
    expect(handler).to.have.been.calledTwice
  })

  it('should allow read/write access to all primary properties through the private standard API', () => {
    // given
    const emitter = new EventEmitter()
    const propModel = new PropsModel(emitter)
    const api = propModel.getStandardPrivateApi()
    propModel.defineProp('foo1', 1)
    propModel.defineProp('_foo2', 2)

    // when
    api.set('foo1', 10)
    api.set('_foo2', 'bar')

    // then
    expect(api.get('foo1')).to.equal(10)
    expect(api.get('_foo2')).to.equal('bar')
  })

  it('should allow read access to derived properties through the private standard API', () => {
    // given
    const emitter = new EventEmitter()
    const propModel = new PropsModel(emitter)
    const api = propModel.getStandardPrivateApi()
    propModel.defineProp('foo1', 1)
    propModel.defineDerivedProp('_bar1', ['foo1'], foo1 => 2 * foo1)
    propModel.defineDerivedProp('bar2', ['_bar1', 'foo1'], (bar1, foo1) => (2 * foo1) + (3 * bar1))

    // when
    api.set('foo1', 10)

    // then
    expect(api.get('foo1')).to.equal(10)
    expect(api.get('_bar1')).to.equal(20)
    expect(api.get('bar2')).to.equal(80)
  })

  it('should not allow write access to derived properties through the private standard API', () => {
    // given
    const emitter = new EventEmitter()
    const propModel = new PropsModel(emitter)
    const api = propModel.getStandardPrivateApi()
    propModel.defineProp('foo1', 1)
    propModel.defineDerivedProp('_bar1', ['foo1'], foo1 => 2 * foo1)
    propModel.defineDerivedProp('bar2', ['_bar1', 'foo1'], (bar1, foo1) => (2 * foo1) + (3 * bar1))

    // expect
    expect(() => api.set('_bar1', 20)).to.throw('Write access to _bar1 is not allowed because the property is a derived property.')
    expect(() => api.set('bar2', 20)).to.throw('Write access to bar2 is not allowed because the property is a derived property.')
    expect(propModel.get('_bar1')).to.equal(2)
    expect(propModel.get('bar2')).to.equal(8)
  })

  it('should not allow write access to derived properties through the public standard API', () => {
    // given
    const emitter = new EventEmitter()
    const propModel = new PropsModel(emitter)
    const api = propModel.getStandardPublicApi()
    propModel.defineProp('foo1', 1)
    propModel.defineDerivedProp('_bar1', ['foo1'], foo1 => 2 * foo1)
    propModel.defineDerivedProp('bar2', ['_bar1', 'foo1'], (bar1, foo1) => (2 * foo1) + (3 * bar1))

    // expect
    expect(() => api.set('_bar1', 20)).to.throw('Property is not publicly accessible: _bar1')
    expect(() => api.set('bar2', 20)).to.throw('Write access to bar2 is not allowed because the property is a derived property.')
    expect(propModel.get('_bar1')).to.equal(2)
    expect(propModel.get('bar2')).to.equal(8)
  })

  it('should not allow read or write access to protected properties through the public standard API', () => {
    // given
    const emitter = new EventEmitter()
    const propModel = new PropsModel(emitter)
    const api = propModel.getStandardPublicApi()
    propModel.defineProp('_bar1', 2)

    // expect
    expect(() => api.get('_bar1')).to.throw('Property is not publicly accessible: _bar1')
    expect(() => api.set('_bar1', 20)).to.throw('Property is not publicly accessible: _bar1')
    expect(propModel.get('_bar1')).to.equal(2)
  })

  ;[
    ['PropertyModel', propModel => propModel],
    ['public standard API', propModel => propModel.getStandardPublicApi()],
    ['private standard API', propModel => propModel.getStandardPrivateApi()]
  ].forEach(([ source, provider ]) => {
    it(`should install appropriate accessors on target object when accessed via the ${source}`, () => {
      // given
      const emitter = new EventEmitter()
      const propModel = new PropsModel(emitter)
      propModel.defineProp('foo', 2)
      propModel.defineProp('bar', 3)
      propModel.defineProp('baz', 5)
      propModel.defineProp('trot', 7)
      propModel.defineProp('thunder', 11)
      const target = {}
      const access = provider(propModel)

      // when
      access.installAccessors(target, {
        bar: 'readonly',
        baz: 'readwrite',
        foo: 'readwrite',
        thunder: 'none'
      })

      // then
      expect(target.getBar()).to.equal(3)
      expect(target.getBaz()).to.equal(5)
      expect(target.getFoo()).to.equal(2)
      expect(target).to.not.haveOwnProperty('setBar')
      expect(target).to.not.haveOwnProperty('getTrot')
      expect(target).to.not.haveOwnProperty('setTrot')
      expect(target).to.not.haveOwnProperty('getThunder')
      expect(target).to.not.haveOwnProperty('setThunder')

      // when
      target.setBaz(15)
      target.setFoo(18)

      // then
      expect(propModel.get('baz')).to.equal(15)
      expect(propModel.get('foo')).to.equal(18)
    })
  })

  it('should not allow a property to be derived from a property that is not already defined', () => {
    // given
    const propModel = new PropsModel(new EventEmitter())
    propModel.defineProp('foo', 10)

    // expect
    expect(() => propModel.defineDerivedProp('bar', ['foo', 'baz'], () => 15)).to.throw('Cannot create utilizer of unknown property \'baz\'')
    expect(() => propModel.get('bar')).to.throw('No such property \'bar\'')
  })

  it('should not allow a property to be derived from itself', () => {
    // given
    const propModel = new PropsModel(new EventEmitter())
    propModel.defineProp('foo', 10)

    // expect
    expect(() => propModel.defineDerivedProp('bar', ['foo', 'bar'], () => 15)).to.throw('Cannot create utilizer of unknown property \'bar\'')
    expect(() => propModel.get('bar')).to.throw('No such property \'bar\'')
  })

  it('should generate expected JSON', () => {
    // given
    const propModel = new PropsModel(new EventEmitter())
    propModel.defineProp('foo', 10)
    propModel.defineProp('_bar', 'bar-value')
    propModel.defineDerivedProp('baz', ['foo', '_bar'], (foo, bar) => ({ twiceFoo: foo * 2, bar }))

    // when
    propModel.set('_bar', 'new-bar-value')
    propModel.set('foo', 15)

    // expect
    expect(propModel.toJSON()).to.deep.equal({
      foo: 15,
      _bar: 'new-bar-value',
      baz: {
        twiceFoo: 30,
        bar: 'new-bar-value'
      }
    })
  })

  it('should generate expected JSON through the standard private API', () => {
    // given
    const propModel = new PropsModel(new EventEmitter())
    propModel.defineProp('foo', 10)
    propModel.defineProp('_bar', 'bar-value')
    propModel.defineDerivedProp('baz', ['foo', '_bar'], (foo, bar) => ({ twiceFoo: foo * 2, bar }))

    // when
    propModel.set('_bar', 'new-bar-value')
    propModel.set('foo', 15)

    // expect
    expect(propModel.getStandardPrivateApi().toJSON()).to.deep.equal({
      foo: 15,
      _bar: 'new-bar-value',
      baz: {
        twiceFoo: 30,
        bar: 'new-bar-value'
      }
    })
  })

  it('should generate expected JSON through the standard public API', () => {
    // given
    const propModel = new PropsModel(new EventEmitter())
    propModel.defineProp('foo', 10)
    propModel.defineProp('_bar', 'bar-value')
    propModel.defineDerivedProp('baz', ['foo', '_bar'], (foo, bar) => ({ twiceFoo: foo * 2, bar }))

    // when
    propModel.set('_bar', 'new-bar-value')
    propModel.set('foo', 15)

    // expect
    expect(propModel.getStandardPublicApi().toJSON()).to.deep.equal({
      foo: 15,
      baz: {
        twiceFoo: 30,
        bar: 'new-bar-value'
      }
    })
  })

  describe('prop views', () => {
    it('should give the calculated value for the view', () => {
      // given
      const propModel = new PropsModel(new EventEmitter())
      propModel.defineProp('foo', [10, 20])
      propModel.definePropView('foo-x', 'foo', ([x, y]) => x, (newX, [x, y]) => [newX, y])

      // expect
      expect(propModel.get('foo-x')).to.equal(10)
    })

    it('should update the view value when the base property changes', () => {
      // given
      const propModel = new PropsModel(new EventEmitter())
      propModel.defineProp('foo', [10, 20])
      propModel.definePropView('foo-x', 'foo', ([x, y]) => x, (newX, [x, y]) => [newX, y])

      // when
      propModel.set('foo', [30, 40])

      // then
      expect(propModel.get('foo-x')).to.equal(30)
    })

    it('should update the base property when the view is written', () => {
      // given
      const propModel = new PropsModel(new EventEmitter())
      propModel.defineProp('foo', [10, 20])
      propModel.definePropView('foo-x', 'foo', ([x, y]) => x, (newX, [x, y]) => [newX, y])

      // when
      propModel.set('foo-x', 57)

      // then
      expect(propModel.get('foo')).to.deep.equal([57, 20])
    })
  })

  describe('array prop views', () => {
    it('should give the specified index of the array base prop as the view value', () => {
      // given
      const propModel = new PropsModel(new EventEmitter())
      propModel.defineProp('foo', [10, 20])
      propModel.defineViewOfArrayProp('foo-0', 'foo', 0)

      // expect
      expect(propModel.get('foo-0')).to.equal(10)

      // when
      propModel.set('foo', [13, 23])

      // then
      expect(propModel.get('foo-0')).to.equal(13)
    })

    it('should overwrite the specified index of the base prop array when the view is set', () => {
      // given
      const propModel = new PropsModel(new EventEmitter())
      propModel.defineProp('foo', [10, 20])
      propModel.defineViewOfArrayProp('foo-1', 'foo', 1)

      // when
      propModel.set('foo-1', 144)

      // then
      expect(propModel.get('foo')).to.deep.equal([10, 144])
    })
  })

  describe('object prop views', () => {
    it('should give the specified property of the base prop as the view value', () => {
      // given
      const propModel = new PropsModel(new EventEmitter())
      propModel.defineProp('foo', { x: 10, y: 20 })
      propModel.defineViewOfObjectProp('foo-x', 'foo', 'x')

      // then
      expect(propModel.get('foo-x')).to.equal(10)

      // when
      propModel.set('foo', { x: 19, z: 'whatever' })

      // then
      expect(propModel.get('foo-x')).to.equal(19)
    })

    it('should overwrite the specified property of the base prop object when the view is set', () => {
      // given
      const propModel = new PropsModel(new EventEmitter())
      propModel.defineProp('foo', { x: 10, y: 20 })
      propModel.defineViewOfObjectProp('foo-y', 'foo', 'y')

      // when
      propModel.set('foo-y', 399)

      // then
      expect(propModel.get('foo')).to.deep.equal({ x: 10, y: 399 })
    })
  })
})
