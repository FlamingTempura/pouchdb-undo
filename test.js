/* global it, before, describe */

'use strict';

var PouchDB = require('pouchdb'),
	memdown = require('memdown'),
	Bluebird = require('bluebird'),
	_ = require('underscore');

require('should');

PouchDB.plugin(require('./'));

describe('PouchDB Undo Plugin', function () {

	describe('Reverting removal', function () {
		var db = new PouchDB('test0', { db: memdown });
		db.enableUndo();
		var rev, undoId, oldUndoId;
		it('should return undoId on putting of new document', function () {
			return db.put({ _id: 'doc1', message: 'Hello' }).then(function (result) {
				result.should.have.property('undoId').which.is.a.String();
				rev = result.rev;
			});
		});
		it('should return undoId on putting of changed document', function () {
			return db.put({ _id: 'doc1', message: 'Hello world', _rev: rev }).then(function (result) {
				result.should.have.property('undoId').which.is.a.String();
				rev = result.rev;
				oldUndoId = result.undoId;
			});
		});
		it('should return undoId on removing document', function () {
			return db.remove('doc1', rev).then(function (result) {
				result.should.have.property('undoId').which.is.a.String();
				undoId = result.undoId;
			});
		});
		it('should not allow use of old undoId', function () {
			return db.undo(oldUndoId).then(function () {
				throw new Error('Undo should fail');
			}).catch(function (err) {
				if (!err.error) { throw err; }
				err.should.have.property('status').which.is.equal(409);
			});
		});
		it('should allow undoing removal of document', function () {
			return db.undo(undoId).then(function (result) {
				result.should.have.property('ok').which.is.equal(true);
				return db.get('doc1', function () {
					result.message.should.equal('Hello world');
				});
			});
		});
		it('should fail when providing an invalid undoId', function () {
			return db.undo('blah').then(function () {
				throw new Error('Should fail');
			}).catch(function (err) {
				if (!err.error) { throw err; }
				err.should.have.property('status').which.is.equal(404);
			});
		});
	});


	describe('Reverting changes', function () {
		var db = new PouchDB('test1', { db: memdown });
		db.enableUndo();
		var rev, undoId;
		it('should return undoId on posting of new document', function () {
			return db.post({ _id: 'doc2', message: 'Space' }).then(function (result) {
				result.should.have.property('undoId').which.is.a.String();
				rev = result.rev;
			});
		});
		it('should return undoId on putting of changed document', function () {
			return db.put({ _id: 'doc2', message: 'Space ship', _rev: rev }).then(function (result) {
				result.should.have.property('undoId').which.is.a.String();
				undoId = result.undoId;
			});
		});
		it('should allow undoing change of document', function () {
			return db.undo(undoId).then(function (result) {
				result.should.have.property('ok').which.is.equal(true);
				return db.get('doc2').then(function (result) {
					result.message.should.equal('Space');
				});
			});
		});
	});

	describe('Reverting recreation', function () {
		var db = new PouchDB('test2', { db: memdown });
		db.enableUndo();
		var rev, undoId;
		it('should return undoId on putting of new document', function () {
			return db.put({ _id: 'doc3', message: 'Chair' }).then(function (result) {
				result.should.have.property('undoId').which.is.a.String();
				rev = result.rev;
			});
		});
		it('should return undoId on removing document', function () {
			return db.remove('doc3', rev).then(function (result) {
				result.should.have.property('undoId').which.is.a.String();
			});
		});
		it('should return undoId on recreation of document', function () {
			return db.put({ _id: 'doc3', message: 'Chair leg' }).then(function (result) {
				result.should.have.property('undoId').which.is.a.String();
				undoId = result.undoId;
			});
		});
		it('should allow undoing recreation of document', function () {
			return db.undo(undoId).then(function (result) {
				result.should.have.property('ok').which.is.equal(true);
				return db.get('doc3').then(function (doc) {
					throw new Error('Should not exist');
				}).catch(function (err) {
					if (!err.error) { throw err; }
					err.should.have.property('status').which.is.equal(404);
				});
			});
		});
	});

	describe('Reverting creation', function () {
		var db = new PouchDB('test3', { db: memdown });
		db.enableUndo();
		var rev, undoId;
		it('should return undoId on putting of new document', function () {
			return db.put({ _id: 'doc4', message: 'Arm' }).then(function (result) {
				result.should.have.property('undoId').which.is.a.String();
				rev = result.rev;
				undoId = result.undoId;
			});
		});
		it('should allow undoing creation of document', function () {
			return db.undo(undoId).then(function (result) {
				result.should.have.property('ok').which.is.equal(true);
				return db.get('doc4').then(function (doc) {
					throw new Error('Should not exist');
				}).catch(function (err) {
					if (!err.error) { throw err; }
					err.should.have.property('status').which.is.equal(404);
				});
			});
		});
	});

	describe('Reverting bulk creation', function () {
		var db = new PouchDB('test4', { db: memdown });
		db.enableUndo();
		var undoId;
		it('should allow bulk creation and return a single undoId', function () {
			return db.bulkDocs([
				{ _id: 'bdocA', message: 'Bee' },
				{ _id: 'bdocB', message: 'Ant' },
				{ _id: 'bdocC', message: 'Fly' }
			]).then(function (result) {
				undoId = result[0].undoId;
				result[1].undoId.should.equal(undoId);
				result[2].undoId.should.equal(undoId);
			});
		});
		it('should revert creation', function () {
			return db.undo(undoId).then(function () {
				return db.allDocs({
					startkey: 'bdoc',
					endkey: 'bdoc\uffff'
				}).then(function (result) {
					result.total_rows.should.equal(0);
				});
			});
		});
	});

	describe('Reverting bulk update', function () {
		var db = new PouchDB('test5', { db: memdown });
		db.enableUndo();
		var undoId, revA, revB;
		before(function () {
			return db.put({ _id: 'rdocA', message: 'cactus' }).then(function (result) {
				revA = result.rev;
				return db.put({ _id: 'rdocB', message: 'tree' });
			}).then(function (result) {
				revB = result.rev;
				return db.put({ _id: 'rdocC' });
			});
		});
		it('should allow bulk update and return a single undoId', function () {
			return db.bulkDocs([
				{ _id: 'rdocA', _rev: revA, message: 'Cactus' },
				{ _id: 'rdocB', _rev: revB, message: 'Tree' }
			]).then(function (result) {
				undoId = result[0].undoId;
				result[1].undoId.should.equal(undoId);
			});
		});
		it('should revert update', function () {
			return db.undo(undoId).then(function () {
				return db.get('rdocA');
			}).then(function (doc) {
				doc.message.should.equal('cactus');
				return db.get('rdocB');
			}).then(function (doc) {
				doc.message.should.equal('tree');
			});
		});
	});

	describe('Reverting with partial conflict', function () {
		var db = new PouchDB('test6', { db: memdown });
		db.enableUndo();
		var undoId, revA;
		it('should allow bulk creation and return a single undoId', function () {
			return db.bulkDocs([
				{ _id: 'cdocA', message: 'Bee' },
				{ _id: 'cdocB', message: 'Ant' }
			]).then(function (result) {
				undoId = result[0].undoId;
				result[1].undoId.should.equal(undoId);
				revA = result[0].rev;
			});
		});
		it('should fail to revert creation', function () {
			return db.put({ _id: 'cdocA', _rev: revA, message: 'Bumble bee' }).then(function () {
				return db.undo(undoId);
			}).then(function () {
				throw new Error('Should have conflicts');
			}).catch(function (err) {
				if (!err.error) { throw err; }
				err.should.have.property('status').which.is.equal(409);
			});
		});
	});

	
	describe('Clear undo history', function () {
		var db = new PouchDB('test7', { db: memdown }),
			undoId;
		db.enableUndo();
		it('should allow history to be cleared', function () {
			return db.put({ _id: 'blah' }).then(function (result) {
				undoId = result.undoId;
				return db.get('_local/_undo');
			}).then(function () {
				return db.clearUndo();
			}).then(function () {
				return db.get('_local/_undo').then(function () {
					throw new Error('Should not exist');
				}).catch(function (err) {
					if (!err.error) { throw err; }
					err.should.have.property('status').which.is.equal(404);
				});
			});
		});

		it('should not fail if already deleted', function () {
			return db.clearUndo();
		});
	});

	describe('Limit', function () {
		var db = new PouchDB('test7', { db: memdown });
		db.enableUndo({ limit: 10 });
		it('should allow history to be cleared', function () {
			return Bluebird.map(_.times(15, function (i) { return i; }), function (i) {
				return db.put({ _id: 'blah' + i });
			}, { concurrency: 1 }).then(function () {
				return db.get('_local/_undo');
			}).then(function (undoDoc) {
				undoDoc.history.length.should.be.lessThan(11);
				Object.keys(undoDoc.undos).length.should.be.lessThan(11);
			});
		});
	});
});
