var mongo = require( './mongo' )
  , async = require( 'async' )

// ** Storage
module.exports.Storage = function( callback ) {
    // ** Storage instance
    var self = { }

    // ** Database tables
    var apps            = null
    var reviews         = null
    var users           = null
    var metadata        = null

    // ** Days between the updates
    var updateDelay     = 7

    // ** Connect to a database
    mongo.connect( 'mongodb://127.0.0.1/playmarket',
        function( err, result ) {
            if( err ) return callback( err )

            // ** Get the database tables
            apps        = mongo.collection( 'apps' )
            reviews     = mongo.collection( 'reviews' )
            users       = mongo.collection( 'users' )
            metadata    = mongo.collection( 'metadata' )

            // ** Run a callback
            callback( null, self )
        } )

    // ** updateUser
    self.updateUser = function( id, name, actions, callback ) {
        users.findAndModify( { userId: id }, { userId: id, name: name, actions: actions },
            function( err, result ) {
                if( err ) return callback( err )

                // ** Update user timestamp
                updateUserTimestamp( result )

                // ** Run a callback
                callback( null, result )
            } )
    }

    // ** findOutdatedApplication
    self.findOutdatedApplication = function( callback ) {
        apps.find( {},
            function( err, result ) {
                if( err ) return callback( err )

                var randomIdx = Math.floor( Math.random() * (result.length - 1) )
                callback( null, result[randomIdx] )
            } )
    }

    // ** findEmptyUsers
    self.findEmptyUsers = function( callback ) {
        users.find( { query: { name: '' } }, callback )
    }

    // ** findUserToParse
    self.findUserToParse = function( callback ) {
        users.find( { query: { name: '' } },
            function( err, result ) {
                if( err ) callback( err )

                var randomIdx = Math.floor( Math.random() * (result.length - 1) )
                callback( null, result[randomIdx] )
            } )
    }

    // ** isUserUpToDate
    self.isUserUpToDate = function( id, callback ) {
        users.findOne( { userId: id },
            function( err, result ) {
                if( err )       return callback( err )
                if( !result )   return callback( null, false )

                // ** User exists - check the timestamp
                checkTimestamp( 'userId', result._id, callback )
            } )
    }

    // ** updateApplication
    self.updateApplication = function( id, callback ) {
        apps.findAndModify( { appId: id }, { appId: id },
            function( err, result ) {
                if( err ) return callback( err )

                // ** Update app timestamp
                updateAppTimestamp( result )

                // ** Run a callback
                callback( null, result )
            } )
    }

    // ** isApplicationUpToDate
    self.isApplicationUpToDate = function( id, callback ) {
        apps.findOne( { appId: id },
            function( err, result ) {
                if( err )       return callback( err )
                if( !result )   return callback( null, false )

                // ** Application exists - check the timestamp
                checkTimestamp( 'appId', result._id, callback )
            } )
    }

    // ** updateReview
    self.updateReview = function( appId, userId, rating, callback ) {
        reviews.findAndModify( { appId: appId, userId: userId }, { appId: appId, userId: userId, rating: rating }, callback )
    }

    // ** upgrade
    self.upgrade = function( callback ) {
        var lastUpdateTime = new Date()
        lastUpdateTime.setDate( lastUpdateTime.getDate() - updateDelay )

        apps.find( {},
            function( err, results ) {
                async.each( results,
                    function( item, callback ) {
                        metadata.upsertOne( { appId: item._id }, { appId: item._id, timestamp: lastUpdateTime }, callback )
                    },
                    function( err, results ) {
                        console.log( 'Application metadata upgraded', err )
                    } )
            } )

        users.find( {},
            function( err, results ) {
                async.each( results,
                    function( item, callback ) {
                        metadata.upsertOne( { userId: item._id }, { userId: item._id, timestamp: lastUpdateTime }, callback )
                    },
                    function( err, results ) {
                        console.log( 'User metadata upgraded', err )
                    } )
            } )
    }

    // ** fixMissingReviewRecords
    self.fixMissingReviewRecords = function( callback ) {
        users.find( {},
            function( err, results ) {
                if( err ) return callback( err )

                // ** For each user
                async.each( results,
                    function( item, callback ) {
                        // ** For each action
                        async.each( item.actions,
                            function( action, callback ) {
                                // ** Update a review
                                self.updateReview( action.appId, item.userId, action.rating, callback )
                            },
                            callback )
                    }, callback )
            } )
    }

    // ** fixMissingUserRecords
    self.fixMissingUserRecords = function( callback ) {
        reviews.distinctBy( 'userId',
            function( err, results ) {
                if( err ) return callback( err )

                // ** For each user id
                async.each( results,
                    function( item, callback ) {
                        self.updateUser( item, '', [], callback )
                    }, callback )
            } )
    }

    // ** check
    self.check = function( callback ) {
        reviews.find( {},
            function( err, results ) {
                console.log( 'Checking', results.length, 'reviews...' )

                async.filter( results,
                    function( item, callback ) {
                        users.findOne( { userId: item.userId },
                            function( err, result ) {
                                callback( !result )
                            } )
                    },
                    function( results ) {
                        console.log( 'Missing', results.length, 'user records' )
                    } )
            } )

        // ** Check user actions
        users.find( {},
            function( err, results ) {
                console.log( 'Checking', results.length, 'users...' )

                var counter = 0
                var totalUserRatings = 0
                var totalAppRating   = 0
                var idx = 0, total = results.length

                // ** For each loaded user
                async.each( results,
                    function( item, callback ) {
                        totalUserRatings += item.actions.length

                        // ** Filter that actions that does not have a records in a review table
                        async.filter( item.actions,
                            function( action, callback ) {
                                totalAppRating += action.rating

                                // ** Lookup a review record by user & app id
                                reviews.findOne( { userId: item.userId, appId: action.appId },
                                    function( err, result ) {
                                        callback( !result )
                                    } )
                            },
                            function( results ) {
                                idx++
                                console.log( idx, total )

                                counter += results.length
                                callback()
                            } )
                    },
                    function( err ) {
                        console.log( 'Missing', counter, 'review records' )
                        console.log( Math.floor( totalUserRatings / total ), 'ratings per user' )
                        console.log( Math.floor( totalAppRating / totalUserRatings ), 'average rating' )
                    } )
            } )
    }

    // ** checkTimestamp
    function checkTimestamp( field, id, callback ) {
        var params = {}
        params[field] = id

        metadata.findOne( params,
            function( err, result ) {
                if( err ) return callback( err )

                var daysPassed = result ? calculateDaysPassed( result.timestamp, new Date() ) : updateDelay
                callback( null, daysPassed < updateDelay )
            } )
    }

    // ** updateAppTimestamp
    function updateAppTimestamp( app, callback ) {
        updateTimestamp( { appId: app._id }, callback )
    }

    // ** updateUserTimestamp
    function updateUserTimestamp( user, callback ) {
        updateTimestamp( { userId: user._id }, callback )
    }

    // ** updateTimestamp
    function updateTimestamp( filter, callback ) {
        metadata.findAndModify( filter, { $set: { timestamp: new Date() } }, callback ? callback : function() {} )
    }

    // ** calculateDaysPassed
    function calculateDaysPassed( start, end ) {
        var oneDay = 24 * 60 * 60 * 1000 // ** H * M * S * Ms
        return Math.round( Math.abs( (end.getTime() - start.getTime()) / oneDay ) )
    }

    return self
}