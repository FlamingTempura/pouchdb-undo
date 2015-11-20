PouchDB Undo Plugin
=====

Adds undo functionality to all operations (put, post, remove and bulkDocs) on a database. It allows the reversal of creations, changes and deletions.

Usage
---

To use this plugin, include it after `pouchdb.js` in your HTML page:

```html
<script src="pouchdb.js"></script>
<script src="pouchdb.undo.js"></script>
```

Or to use it in Node.js, just npm install it:

```bash
npm install pouchdb-undo
```

And then attach it to the `PouchDB` object:

```js
var PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-undo'));
```


API
---

###undo(undoId)

When calling undo, an undoId must be provided. An undoId is returned with each call to put, post, remove or bulkDocs.

###put, post and remove

For put, post and remove, an undoId is returned within the result:

```js
var pouch = new PouchDB('animals');
pouch.enableUndo();

pouch.put({ _id: 'dog', sound: 'bark' }).then(function (result) {
  return pouch.put({ _id: 'dog', _rev: result.rev, sound: 'woof'});
}).then(function (result) {
  return pouch.undo(result.undoId);
}).then(function () {
  return pouch.get('dog')
}).then(function (dog) {
  // dog.sound === 'bark'
});
```

###bulkDocs

For bulkDocs, the undoId is returned within the each row of the result (and they will have identical undoIds)

```js
pouch.bulkDocs([
  { _id: 'dog', sound: 'woof' },
  { _id: 'cat', sound: 'miow' }
]).then(function (result) {
  return pouch.undo(result[0].undoId);
}).then(function () {
  return pouch.get('dog'); // --> 404 not_found
});
```

Advanced usage
----

Undo history is stored in _local documents (so they will not show up in allDocs, and they are not synced). By default, up to 100 undo's are stored, which can be changed by providing options to enableUndo:

```js
pouch.enableUndo({ limit: 500 });
```

You can clear the entire undo history manually:
```javascript
pouch.clearUndo()
```


Building
----
```bash
npm install
npm run build
```

Testing
----

### In Node

This will run the tests in Node using LevelDB:

    npm test    


Limitations
----
1. At the moment a model can only be reverted once
2. Making multiple changes at once to a database will lead to only one being kept in the undo history
3. Undo will not work well if there are multiple leaves (unresolved conflicts)
