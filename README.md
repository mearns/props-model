# props-model

A javascript package providing a model for properties, including change events and derived properties.

## Overview

This package provides the `PropertyModel` class which can serve as the M in an MVC pattern, or more generally
to track and manage a set of named properties. In addition to get and modify access for the properties, the
model also provides synchronous change event firing and listener creation for the managed properties. It
also allows you to define _derived properties_ whose values are automatically calculated anytime a property
it depends on changes.

## Install

With npm:

```console
npm install --save props-model
```

## Demo Usage

```javascript
const PropModel = require('.')
const EventEmitter = require('events')

class MutableRectangle {
  constructor (initialLength, initialWidth) {
    // Define the properties of this object.
    const propModel = new PropModel(new EventEmitter())
      // These are "primary" properties, they are not calculated from other properties.
      .defineProp('length', initialLength, isValidDimension)
      .defineProp('width', initialWidth, isValidDimension)
      // These are "derived" properties, they are automatically updated when any of
      // the properties they depend on change.
      .defineDerivedProp('area', ['length', 'width'], (length, width) => length * width)
      .defineDerivedProp('perimeter', ['length', 'width'], (length, width) => (2 * length) + (2 * width))
      .defineDerivedProp('aspectRatio', ['length', 'width'], (length, width) => length / width)

    // We can use the propModel as an implementation detail, and expose classical getters and setters
    // for our props. This method on the propModel does that for us.
    propModel.installAccessors(this, {
      // getter and setters for our primary properties.
      length: 'readwrite',
      width: 'readwrite',
      // It's not usually a good idea to allow derived properties to be set directly,
      // it breaks coherency. Only getters will be provided for these properties.
      area: 'readonly',
      perimeter: 'readonly',
      aspectRatio: 'readonly'
    })

    // Our propModel also provides a convenient JSON representation of our properties,
    // which we will adopt as our own.
    this.toJSON = () => propModel.toJSON()

    // Note that we don't need to keep propModel around as an instance property, it's
    // attached to the accessors' closures as needed; it's _generally_ good practice to
    // set up all uses of the propModel in the constructor, and *not* use it directly
    // after that.
  }
}

// Optional property value validators can be provided for primary properties.
function isValidDimension (dim) {
  if (typeof dim !== 'number') {
    throw new Error('Invalid dimension, must be a number')
  }
  if (dim < 0) {
    throw new Error('Invalid dimension, must be non-negative')
  }
}

// Let's exercise our new class a bit:
function main () {
  const rect = new MutableRectangle(10, 20)

  // JSON.stringify uses the toJSON() method attached ot the object.
  console.log(JSON.stringify(rect)) // {"length":10,"width":20,"area":200,"perimeter":60,"aspectRatio":0.5}

  // When we set a property...
  rect.setLength(15)

  // ...that property is updated ...
  console.log(rect.getLength()) // 15

  // ... and so are derived properties ...
  console.log(rect.getArea()) // 300
  console.log(JSON.stringify(rect)) // {"length":15,"width":20,"area":300,"perimeter":70,"aspectRatio":0.75}
}

main()

```
