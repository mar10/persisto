;(function($, window, document, undefined) {
// jQUnit defines:
// asyncTest,deepEqual,equal,expect,module,notDeepEqual,notEqual,notStrictEqual,ok,QUnit,raises,start,stop,strictEqual,test

/*globals QUnit */
/*globals TEST_TOOLS, PersistentObject */

	/* Setup */
	QUnit.testStart(function(){
		window.sessionStorage.clear();
		window.localStorage.clear();
	});

	/* Tear Down */
	QUnit.testDone(function(){
	});


	QUnit.module( "Functional tests" );

    QUnit.test( "Access core data (storage = null)", function( assert ) {
		assert.expect(21);

		assert.equal( window.localStorage.length, 0, "localStorage is clean" );

		assert.throws(function(){
				var _dummy = PersistentObject();
			}, /Must use 'new' keyword/,
			"Fail if 'new' keyword is missing");

		assert.throws(function(){
				var _dummy = new PersistentObject();
			}, /Missing required argument: namespace/,
			"Fail if 'namespace' argument is missing");

		var store = new PersistentObject("foo", {
						storage: null,  // don't commit/update local storage
						remote: null  // don't pull/push to remote endpoint
					});

		assert.equal( window.localStorage.length, 0, "localStorage is still clean" );
		assert.equal( store.namespace, "foo", "namespace is set" );
		assert.ok( $.isEmptyObject(store._data), "initial data is {}" );
		assert.ok( store.get("bar") === undefined, "get() returns undefined" );

		store.set("bar", {baz: 42});
		store.set("bar.boo", "booval");
		store.set("bar.qux", "quxval");
		store.set("arr", ["a", "b", "c"]);
		store.set("arr[1]", "b2");

		assert.equal( window.localStorage.length, 0, "localStorage is not used" );
		assert.equal( store.isDirty(), false, "store.isDirty() == false" );
		assert.ok( store.uncommittedSince > 0, "store.uncommittedSince > 0" );

		assert.deepEqual( store._data, {
		  bar: {baz: 42, boo: "booval", qux: "quxval"},
		  arr: ["a", "b2", "c"]
		}, "data ok" );

		assert.deepEqual( store.get("bar"), {baz: 42, boo: "booval", qux: "quxval"}, "get('bar')" );
		assert.equal( store.get("bar.qux"), "quxval", "get('bar.qux')" );
		assert.equal( store.get("arr[0]"), "a", "get('arr[0]')" );

		assert.throws(function(){
			store.get("bar.qux.undefined.boo");
		}, 
		/PersistentObject\('foo'\): Property 'bar.qux.undefined.boo' could not be accessed because parent 'bar.qux.undefined' does not exist/,
		"get() raises error if parent does not exist");

		store.remove("bar.qux");
		assert.strictEqual( store.get("bar.qux"), undefined, "remove('bar.qux')" );
		store.remove("bar");
		assert.strictEqual( store.get("bar"), undefined, "remove('bar')" );

		store.set("bar.undefined1.test", "testval");
		assert.ok( typeof store._data.bar.undefined1 === "object",
			"set() creates intermediate parents" );
		assert.equal( store._data.bar.undefined1.test, "testval",
			"set() allows missing parents" );

		store.opts.createParents = false;

		assert.throws(function(){
			store.set("bar.undefined2.test", "testval");
		}, 
		/PersistentObject\('foo'\): Property 'bar.undefined2.test' could not be set because parent 'bar.undefined2' does not exist/,
		"set() raises error if createParents is false");

		store.reset({new: "testvalue"});
		assert.deepEqual( store._data, { new: "testvalue" },
			"reset()");
    });


    QUnit.test( "commit/update storage", function( assert ) {
		assert.expect(11);

		assert.equal( window.localStorage.length, 0, "localStorage is clean" );

		var done = assert.async(),
			commitDelay = 100, // 100ms
			store = new PersistentObject("foo", {
						commitDelay: commitDelay,
						remote: null  // don't pull/push remote endpoint
					});

		assert.equal( window.localStorage.length, 0, "localStorage is still clean" );
		assert.equal( store.namespace, "foo", "namespace is set" );
		assert.ok( $.isEmptyObject(store._data), "initial data is {}" );
		assert.ok( store.get("bar") === undefined, "get() returns undefined" );

		store.set("bar", {baz: 42});
		store.set("bar.boo", "booval");
		store.set("bar.qux", "quxval");

		assert.equal( store.isDirty(), true, "store.isDirty()" );
		assert.ok( store.uncommittedSince > 0, "store.uncommittedSince" );
		assert.equal( window.localStorage.length, 0, "data is not yet commited" );

		setTimeout(function(){
			assert.equal( window.localStorage.length, 1, "deferred commit" );
			var data = window.localStorage.getItem("foo");
			data = JSON.parse(data);
			assert.deepEqual( store._data, {
				bar: {baz: 42, boo: "booval", qux: "quxval"}
			}, "data was converted to JSON" );
			assert.equal( store.isDirty(), false, "store.isDirty() was reset" );
			done();
		}, commitDelay + 10);

    });


    QUnit.module( "Form access" );

    QUnit.test( "writeToForm", function( assert ) {
		assert.expect(11);

		var res,
			$form = $("#form1"),
			store = new PersistentObject("foo", {
						remote: null,  // don't pull/push remote endpoint
						defaults: {
							title: "foo",
							details: "bar\nbaz",
							isFavorite: true,
							status: "waiting",
							attributes: ["opt2", "opt3"],
							color: "blue",
							tags: ["hot", "lame"],
							user: {name: "Jack"}						
						}
					});
		
		function _fieldVal(name, select) {
			select = select || "";
			return $form.find("[name='" + name + "']" + select).val();
		}
		
		assert.equal( _fieldVal("title"), " untrimmed ", "form is reset" );
	
		store.writeToForm("#form1");

		assert.equal( _fieldVal("title"), "foo", "text ok" );
		assert.equal( _fieldVal("details"), "bar\nbaz", "textarea ok" );
		assert.ok( _fieldVal("isFavorite", ":checked") !== undefined, "boolean (single-checkbox) ok" );
		assert.equal( _fieldVal("status", ":checked"), "waiting", "radio ok" );
		
		res = $form.find("[name='attributes']:checked");
		assert.equal( res.length, 2, "multi-checkbox ok" );
		assert.equal( res.eq(0).val(), "opt2", "multi-checkbox ok" );
		assert.equal( res.eq(1).val(), "opt3", "multi-checkbox ok" );

		assert.equal( _fieldVal("color"), "blue", "select ok" );
		assert.deepEqual( _fieldVal("tags"), ["hot", "lame"], "select-multiple ok" );

		res = $form.find("[name='user.name']").val();
		assert.equal( res, "Joe", "write nested fields" );
    });


    QUnit.test( "readFromForm", function( assert ) {
		assert.expect(16);

		var $form = $("#form1"),
			store = new PersistentObject("foo", {
							defaults: {
								title: "qux",
								details: "qux",
								isFavorite: undefined,
								status: "qux",
								attributes: "",
								color: "",
								tags: ""
							}
						});

		assert.equal( store._data.title, "qux", "store is initialized" );

		$("#form1 :reset").click();
		assert.equal($form.find("[name='title']").val(), " untrimmed ", "form was reset" );

		store.readFromForm("#form1");

		assert.equal( store._data.title, "untrimmed", "text ok (trimmed by default)" );
		assert.equal( store._data.details, "", "textarea ok" );
		assert.strictEqual( store._data.isFavorite, false, "single checkbox ok" );
		assert.equal( store._data.status, "done", "radio ok" );
		assert.deepEqual( store._data.attributes, ["opt1", "opt2"], "multi-checkbox ok" );
		assert.equal( store._data.color, "green", "select ok" );
		assert.deepEqual( store._data.tags, ["cool", "hot"], "select-multiple ok" );
		assert.strictEqual( store._data.title2, undefined, "no new field added" );
		assert.strictEqual( store._data.user, undefined, "no intermediate object created" );

		assert.strictEqual( store.isDirty(), true, "store.isDirty()" );

		store.readFromForm("#form1", {addNew: true});

		assert.equal( store._data.title2, "new", "addNew added new field" );
		assert.ok( typeof store._data.user === "object", "create intermediate objects" );
		assert.equal( store._data.user.name, "Joe", "addNew new nested field" );

		store.readFromForm("#form1", {trim: false});

		assert.equal( store._data.title, " untrimmed ", "text ok" );

    });

/*
    QUnit.module( "Benchmarks" );

    QUnit.test( "store.get() / set() - without webStorage", function( assert ) {
		var i, v,
		    store = new PersistentObject("foo", {storage: null, debugLevel: 0}),
		    count = 100000;

		   // return;
		store._data.v = 0;
		store._data.x = {y: {z: 0}};

		TEST_TOOLS.makeBenchWrapper("store.get() flat", count, function(){
		    for(i=0; i<count; i++) {
		        v = store.get("v");
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("store.get() deep", count, function(){
		    for(i=0; i<count; i++) {
		        v = store.get("x.y.z");
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("store.set() flat, same value", count, function(){
		    for(i=0; i<count; i++) {
		        v = store.set("v", 0);
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("store.set() flat, changing value", count, function(){
		    for(i=0; i<count; i++) {
		        v = store.set("v", i);
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("store.set() deep, same value", count, function(){
		    for(i=0; i<count; i++) {
		        v = store.set("x.y.z", 0);
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("store.set() deep, changing value", count, function(){
		    for(i=0; i<count; i++) {
		        v = store.set("x.y.z", i);
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("_data.get() deep", count, function(){
		    for(i=0; i<count; i++) {
		        v = store._data.x.y.z;
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("_data.set() deep", count, function(){
		    for(i=0; i<count; i++) {
		        store._data.x.y.z = i;
		    }
		})();

    });

    QUnit.test( "store.get() / set() - with webStorage and deferred commit", function( assert ) {
		var i, v,
		    store = new PersistentObject("foo", {storage: window.sessionStorage, debugLevel: 0}),
		    count = 10000;

		   // return;
		store._data.v = 0;
		store._data.x = {y: {z: 0}};

		TEST_TOOLS.makeBenchWrapper("store.get() flat", count, function(){
		    for(i=0; i<count; i++) {
		        v = store.get("v");
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("store.get() deep", count, function(){
		    for(i=0; i<count; i++) {
		        v = store.get("x.y.z");
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("store.set() flat, same value", count, function(){
		    for(i=0; i<count; i++) {
		        v = store.set("v", 0);
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("store.set() flat, changing value", count, function(){
		    for(i=0; i<count; i++) {
		        v = store.set("v", i);
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("store.set() deep, same value", count, function(){
		    for(i=0; i<count; i++) {
		        v = store.set("x.y.z", 0);
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("store.set() deep, changing value", count, function(){
		    for(i=0; i<count; i++) {
		        v = store.set("x.y.z", i);
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("_data.get() deep", count, function(){
		    for(i=0; i<count; i++) {
		        v = store._data.x.y.z;
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("_data.set() deep", count, function(){
		    for(i=0; i<count; i++) {
		        store._data.x.y.z = i;
		    }
		})();

    });

    QUnit.test( "store.get() / set() - with webStorage and immediate commit", function( assert ) {
		var i, v,
		    store = new PersistentObject("foo", {storage: window.sessionStorage, commitDelay: 0, debugLevel: 0}),
		    count = 1000;

		   // return;
		store._data.v = 0;
		store._data.x = {y: {z: 0}};

		TEST_TOOLS.makeBenchWrapper("store.get() flat", count, function(){
		    for(i=0; i<count; i++) {
		        v = store.get("v");
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("store.get() deep", count, function(){
		    for(i=0; i<count; i++) {
		        v = store.get("x.y.z");
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("store.set() flat, same value", count, function(){
		    for(i=0; i<count; i++) {
		        v = store.set("v", 0);
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("store.set() flat, changing value", count, function(){
		    for(i=0; i<count; i++) {
		        v = store.set("v", i);
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("store.set() deep, same value", count, function(){
		    for(i=0; i<count; i++) {
		        v = store.set("x.y.z", 0);
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("store.set() deep, changing value", count, function(){
		    for(i=0; i<count; i++) {
		        v = store.set("x.y.z", i);
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("_data.get() deep", count, function(){
		    for(i=0; i<count; i++) {
		        v = store._data.x.y.z;
		    }
		})();

		TEST_TOOLS.makeBenchWrapper("_data.set() deep", count, function(){
		    for(i=0; i<count; i++) {
		        store._data.x.y.z = i;
		    }
		})();

    });
*/

}(jQuery, window, document));
