'use strict';

var wrappers = require('pouchdb-wrappers');

exports.enableUndo = function (options) {
	if (!options) { options = {}; }
	if (!options.hasOwnProperty('limit')) { options.limit = 100; }
	var db = this,
		PouchDB = this.constructor,
		Promise = PouchDB.utils.Promise,
		uuid = PouchDB.utils.uuid,
		error = function (options) {
			var error = new Error(options.reason);
			error.status = options.status;
			error.error = options.error;
			error.reason = options.reason;
			return error;
		},
		origBulkDocs = db.bulkDocs;

	var wrapUndo = function (orig, args) {
		var docs = args.docs;
		return orig().then(function (result) {
			var undoId = uuid();
			return db.get('_local/_undo').catch(function (err) {
				if (err.status !== 404) { throw err; }
				return { _id: '_local/_undo', history: [], undos: {} };
			}).then(function (undoDoc) {
				undoDoc.history.push(undoId);
				undoDoc.undos[undoId] = result.filter(function (row) {
					return row.ok;
				}).map(function (row, i) {
					return {
						id: row.id,
						oldRev: docs[i]._rev,
						newRev: row.rev
					};
				});
				if (undoDoc.history.length > options.limit) {
					undoDoc.history.slice(0, -options.limit).forEach(function (undoId) {
						delete undoDoc.undos[undoId];
						undoDoc.history.shift();
					});
				}
				return origBulkDocs.call(db, [undoDoc]); // FIXME: pouchdb bug? doesn't throw conflict if rev is incorrect
			}).then(function () { 
				return result.map(function (row) {
					row.undoId = undoId;
					return row;
				});
			});
		});
	};

	db.undo = function (undoId) {
		return db.get('_local/_undo').then(function (undoDoc) {
			var revisions = undoDoc.undos[undoId];
			if (typeof revisions === 'undefined') {
				throw error({
					status: 404,
					error: 'not_found',
					reason: 'Undo with that ID not found'
				});
			}
			return Promise.all(revisions.map(function (revision) {
				// get latest revision
				return db.get(revision.id, { open_revs: 'all' }).then(function (doc) {
					var latestRev = doc[0].ok._rev; // HACK: this will stop undo working where there are unresolved conflicts
					if (revision.newRev !== latestRev) {
						throw error({
							status: 409,
							error: 'conflict',
							reason: 'The document has changed since this undoID was issued'
						});
					}
					return db.get(revision.id, { rev: revision.oldRev }).then(function (doc) {
						if (!revision.oldRev) { doc._deleted = true; }
						doc._rev = revision.newRev;
						return doc;
					});
				});
			})).then(function (docs) {
				return origBulkDocs.call(db, docs);
			}).then(function () {
				delete undoDoc.undos[undoId];
				return origBulkDocs.call(db, [undoDoc]);
			});
		}).then(function () {
			return { id: undoId, ok: true };
		});
	};

	db.clearUndo = function () {
		return db.get('_local/_undo').then(function (doc) {
			doc._deleted = true;
			return origBulkDocs.call(db, [doc]);
		}).catch(function (err) {
			if (err.status !== 404) { throw err; }
			// already deleted
		});
	};

	wrappers.installWrapperMethods(db, { bulkDocs: wrapUndo });
};

if (typeof window !== 'undefined' && window.PouchDB) {
	window.PouchDB.plugin(exports);
}
