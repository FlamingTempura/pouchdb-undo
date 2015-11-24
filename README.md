PouchDB Undo Plugin
=====

Adds undo functionality to all operations (put, post, remove and bulkDocs) on a database. It allows the reversal of creations, changes and deletions.

Each operation will return a `undoId` within the response. Use the undoId to revert the operation.

Undo creating a document:
```js
pouch.put({ _id: 'cat' }).then(function (result) {
  return pouch.undo(result.undoId);
});
```

Undo changing a document:
```js
pouch.put({ _id: 'dog', sound: 'bark' }).then(function (result) {
  return pouch.put({ _id: 'dog', _rev: result.rev, sound: 'woof'});
}).then(function (result) {
  return pouch.undo(result.undoId);
});
```

Undo deleting a document:
```js
pouch.put({ _id: 'wolf' }).then(function (result) {
  return pouch.remove('wolf', result.rev);
}).then(function (result) {
  return pouch.undo(result.undoId);
});
```

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

Attach it to the `PouchDB` object and enable it per database:

```js
var PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-undo'));

var animals = new PouchDB('animals');
animals.enableUndo();
```


API
---

###Undo `put`, `post` and `remove`

For put, post and remove, an `undoId` is returned within the result, which must be provided to the `undo` method:

```js
pouch.put({ _id: 'dog', sound: 'bark' }).then(function (result) {
  return pouch.put({ _id: 'dog', _rev: result.rev, sound: 'woof'});
}).then(function (result) {
  // undo changing the dog's sound
  return pouch.undo(result.undoId);
}).then(function () {
  return pouch.get('dog')
}).then(function (dog) {
  // dog.sound === 'bark'
});
```

###Undo `bulkDocs`

For bulkDocs, the `undoId` is returned within the each row of the result (and they will have identical `undoId`s):

```js
pouch.bulkDocs([
  { _id: 'dog', sound: 'woof' },
  { _id: 'cat', sound: 'miow' }
]).then(function (result) {
  // undo creating the cat and dog
  return pouch.undo(result[0].undoId); // result[0].undoId === result[1].undoId
}).then(function () {
  pouch.get('dog'); // --> 404 not_found
  pouch.get('cat'); // --> 404 not_found
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
pouch.clearUndo();
```


Known issues
----
1. At the moment only the latest operation on a document can be reverted.
2. Race condition: making multiple changes at once to a database will lead to only one being kept in the undo history.
3. Undo will not work well if there are multiple leaves (unresolved conflicts) - it will try to apply the undo to the first leaf found.


Building
----
```bash
npm install
npm run build
```

Testing
----

This will run the tests in Node using LevelDB:

    npm test    

