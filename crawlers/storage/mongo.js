var mongo       = require( 'mongodb' )
  , async       = require( 'async' )
  , MongoClient = mongo.MongoClient
  , ObjectID    = mongo.ObjectID
  , DBRef       = mongo.DBRef
  , db          = null

// ** connect
module.exports.connect = function( url, callback ) {
    async.retry( 5,
        function( callback, results ) {
            console.log( 'Connecting to', url )

            MongoClient.connect( url, { native_parser: true },
                function( err, result ) {
                    // ** Failed to connect
                    if( err ) {
                        return setTimeout( function() { callback( err ) }, 5000 )
                    }

                    // ** Connection successful
                    db = result

                    // ** Run a callback
                    callback( null, result )
                } )
        },
        function( err, result ) {
            callback( null, result )
        } )
}

// ** objectId
module.exports.objectId = function( input ) {
    return ObjectID( input )
}

// ** collection
module.exports.collection = function( name ) {
    // ** Create a collection
    var collection = db.collection( name )

    // ** Declare database methods
    var result = {}

    // ** populate
    result.populate = function( document, fields, callback ) {
        // ** Count keys
        var items   = Object.keys( fields )
        var counter = 0

        // ** process
        function process() {
            counter++
            if( counter >= items.length ) {
                callback()
            }
        }

        // ** Iterate over items
        items.forEach(
            function( item ) {
                var keys        = item.split( ':' )
                var id          = keys[0]
                var collection  = keys[1]
                var populate    = fields[item]

                if( !document[id] ) {
                    return process()
                }

                // ** Dereference a linked document
                db.dereference( new DBRef( collection, document[id] ),
                    function( err, result ) {
                        // ** Replace a field by an object
                        document[id] = {}

                        // ** Copy document fields
                        populate.forEach(
                            function( field ) {
                                document[id][field] = result ? result[field] : '...'
                            } )

                        // ** Increase the counter and run a callback
                        process()
                    } )
            } )
    }

    // ** mapReduce
    result.mapReduce = function( target, mapper, reducer, callback ) {
        collection.mapReduce( mapper, reducer, { out: target }, callback ? callback : function() {} )
    }

    // ** count
    result.count = function( filter, callback ) {
        collection.count( filter, callback )
    }

    // ** findOne
    result.findOne = function( filter, callback ) {
        result.find( { query: filter },
            function( err, result ) {
                callback( err, result ? result[0] : null )
            } )
    }

    // ** find
    result.find = function( params, callback ) {
        var cursor = collection.find( params.query, params.fields, params.options )

        if( params.limit ) cursor.limit( params.limit )
        if( params.skip )  cursor.skip( params.skip )

        return callback ? cursor.toArray( callback ) : cursor
    }

    // ** distinctBy
    result.distinctBy = function( name, callback ) {
        collection.distinct( name, callback )
    }

    // ** findById
    result.findById = function( id, callback ) {
        result.findOne( { _id: ObjectID( id ) }, callback )
    }

    // ** updateById
    result.updateById = function( id, data, callback ) {
        collection.update( { _id: ObjectID( id ) }, { $set: data }, callback )
    }

    // ** upsertOne
    result.upsertOne = function( filter, data, callback ) {
        collection.update( filter, data, { upsert: true }, callback )
    }

    // ** update
    result.update = function( filter, data, callback ) {
        collection.update( filter, data, callback )
    }

    // ** findAndModify
    result.findAndModify = function( filter, data, callback ) {
        collection.findAndModify( filter, [], data, { 'new': true, upsert: true, w: 1 }, callback )
    }

    // ** pull
    result.pull = function( filter, data, callback ) {
        collection.update( filter, { $pull: data }, callback )
    }

    // ** pushToSet
    result.pushToSet = function( filter, data, callback ) {
        collection.update( filter, { $addToSet: data }, { upsert: true }, callback )
    }

    // ** countBy
    result.countBy = function( filter, callback ) {
        collection.count( filter, callback )
    }

    // ** removeBy
    result.removeBy = function( filter, callback ) {
        collection.remove( filter, callback )
    }

    // ** insertOne
    result.insertOne = function( document, callback ) {
        collection.insert( document,
            function( err, result ) {
                if( err ) return callback( err )
                callback( null, result[0] )
            } )
    }

    // ** createUniqueIndex
    result.createUniqueIndex = function( key, callback ) {
        collection.ensureIndex( key, { unique: true, dropDups: true }, callback ? callback : function() {} )
    }

    // ** dropIndex
    result.dropIndex = function( key, callback ) {
        collection.dropIndex( key, callback ? callback : function() {} )
    }

    // ** createIndex
    result.createIndex = function( key, callback ) {
        collection.ensureIndex( key, callback ? callback : function() {} )
    }

    return result
}