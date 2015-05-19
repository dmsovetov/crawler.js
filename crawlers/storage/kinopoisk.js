var mongo   = require( './mongo' )
  , backup  = require( './backup' )
  , async   = require( 'async' )

// ** Storage
module.exports.Storage = function( callback ) {
    // ** Storage instance
    var self = { }

    // ** Database tables
    var items       = null
    var discovered  = null
    var votes       = null

    // ** Connect to a database
    mongo.connect( 'mongodb://dm.local/kinopoisk',
        function( err, result ) {
            if( err ) return callback( err )

            // ** Get the database tables
            items       = mongo.collection( 'items' )
            discovered  = mongo.collection( 'discovered' )
            votes       = mongo.collection( 'votes' )
            users       = mongo.collection( 'users' )

            // ** Create indices
            discovered.createUniqueIndex( { hash: 1 } )
            items.createUniqueIndex( { itemId: 1 } )
            users.createUniqueIndex( { userId: 1 } )

            backup.schedule( { db: 'kinopoisk' } )

            // ** Run a callback
            callback( null, self )
        } )

    // ** getStats
    self.getStats = function( callback ) {
        async.parallel( {
                votes:      async.apply( votes.count,       {} ),
                discovered: async.apply( discovered.count,  {} ),
                users:      async.apply( users.count,       {} ),
                items:      async.apply( items.count,       {} )
            }, callback )
    }

    // ** cleanupVotes
    self.cleanupVotes = function( callback ) {
        votes.createUniqueIndex( { hash: 1 },
            function() {
                votes.dropIndex( { hash: 1 }, callback )
            } )
    }

    // ** randomDiscovered
    self.randomDiscovered = function( callback ) {
        // ** Get the amount of discovered items
        discovered.count( {},
            function( err, totalDiscovered ) {
                if( totalDiscovered > 100000 ) totalDiscovered = totalDiscovered * 0.1

                // ** Load a random discovered item
                discovered.find( { limit: 1, skip: Math.floor( Math.random() * totalDiscovered ) },
                    function( err, result ) {
                        if( err || !result ) return process.nextTick( function() { console.log( 'Retrying random discovered...' ); self.randomDiscovered( callback ) } )

                        callback( null, result[0] )
                    } )
            } )
    }

    // ** storeUserVotes
    self.storeUserVotes = function( userId, votes, callback ) {
        async.each( votes,
            function( vote, callback ) {
                // ** Discover a new film
                discoverItem( vote.itemId )

                // ** Update vote
                updateVote( vote.itemId, vote.userId, vote.rating, callback )
            },
            function( err ) {
                if( err ) return callback( err )

                // ** Store a processed user
                storeDiscoveredUser( userId, callback )
            } )
    }

    // ** storeItemVotes
    self.storeItemVotes = function( itemId, votes, callback ) {
        // ** Process votes
        async.each( votes,
            function( vote, callback ) {
                // ** Discover a new user
                discoverUser( vote.userId )

                // ** Update vote
                updateVote( vote.itemId, vote.userId, vote.rating, callback )
            },
            function( err ) {
                if( err ) return callback( err )

                // ** Store a processed film
                storeDiscoveredItem( itemId, callback )
            } )
    }

    // ** isUserUpToDate
    self.isUserUpToDate = function( id, callback ) {
        users.findOne( { userId: id },
            function( err, result ) {
                callback( err, result != null )
            } )
    }

    // ** isItemUpToDate
    self.isItemUpToDate = function( id, callback ) {
        items.findOne( { itemId: id },
            function( err, result ) {
                callback( err, result != null )
            } )
    }

    // ** updateVote
    function updateVote( itemId, userId, rating, callback ) {
        votes.insertOne( { itemId: itemId, userId: userId, rating: rating, hash: voteHash( itemId, userId ) }, callback ? callback : function() {} )
    }

    // ** discoverItem
    function discoverItem( id, callback ) {
        callback = callback ? callback : function() {}

        items.findOne( { itemId: id },
            function( err, result ) {
                if( err || result != null ) return callback( err, result )
                discovered.insertOne( { hash: 'i' + id, itemId: id, type: 'item' }, callback )
            } )
    }

    // ** discoverUser
    function discoverUser( id, callback ) {
        callback = callback ? callback : function() {}

        users.findOne( { userId: id },
            function( err, result ) {
                if( err || result != null ) return callback( err, result )
                discovered.insertOne( { hash: 'u' + id, itemId: id, type: 'user' }, callback )
            } )
    }

    // ** storeDiscoveredUser
    function storeDiscoveredUser( id, callback ) {
        users.findOne( { userId: id },
            function( err, result ) {
                if( err ) return callback( err )

                if( !result ) {
                    users.insertOne( { userId: id }, function() {} )
                }

                discovered.removeBy( { hash: 'u' + id },
                    function( err, result ) {
                    //    console.log( 'Removed user', id, 'from discovered' )
                        callback( err, result )
                    } )
            } )
    }

    // ** storeDiscoveredItem
    function storeDiscoveredItem( id, callback ) {
        items.findOne( { itemId: id },
            function( err, result ) {
                if( err ) return callback( err )

                if( !result ) {
                    items.insertOne( { itemId: id }, function() {} )
                }

                discovered.removeBy( { hash: 'i' + id }, callback )
            } )
    }

    // ** voteHash
    function voteHash( itemId, userId ) {
        return itemId + '-' + userId
    }

    return self
}