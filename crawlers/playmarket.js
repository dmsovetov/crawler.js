var async   = require( 'async' )
  , Crawler = require( './crawler' ).Crawler
  , Storage = require( './storage/playmarket' ).Storage
  , android = require( './parsers/playmarket' )

// ** create
module.exports.create = function( id, params, credentials, proxies ) {
    var self        = Crawler( id, params, proxies, providerEmptyUsers )
    var emptyUsers  = null
    var user        = null

    var parser  = android.create( 'ru' )
    var storage = Storage(
        function( err, result ) {
            result.findEmptyUsers(
                function( err, result ) {
                    emptyUsers = result
                    self.crawl()
                } )
        } )

    // ** launch
    self.launch = function( proxy ) {
        user = credentials.random()

        self.message.print( 'Crawler', id, ': starting playmarket crawler as', user.login, self.formatProxy( proxy ) )

        self.proxy      = proxy
        self.isLaunched = true

        parser.setProxy( proxy )
        parser.signin( user.login, user.password,
            function( err, result ) {
                if( err ) return self.handleError( 'Crawler', id, ': failed to sign in', err.message )

                self.message.print( 'Crawler', id, ': probably logged in as', user.login )
                parser.parseUser( '106736497218664428850',
                    function( err, result ) {
                        if( err ) return self.handleError( 'Crawler', id, ': failed to parse test user', err.message )
                        if( result.name == '' ) return self.handleError( 'Crawler', id, ': failed to sign in, invalid session' )

                        self.message.print( 'Crawler', id, ': logged in! Test user name is:', result.name )
                        self.start()
                    } )
            } )
    }

    // ** providerEmptyUsers
    function providerEmptyUsers( queue ) {
        var randomIdx = Math.floor( Math.random() * (emptyUsers.length - 1) )
        var user      = emptyUsers[randomIdx]
        emptyUsers.splice( randomIdx, 1 )

        queue.push( taskUpdateUser( user.userId ) )
    }

    // ** providerOutdatedApplications
    function providerOutdatedApplications( queue ) {
        storage.findOutdatedApplication(
            function( err, result ) {
                if( err ) return self.error.print( 'Crawler', id, ': failed to load random application', err.message )
                queue.push( taskParseApplication( result.appId ) )
            } )
    }

    // ** taskParseApplication
    function taskParseApplication( appId ) {
        return function( callback ) {
            storage.isApplicationUpToDate( appId,
                function( err, result ) {
                    if( err )       return self.handleError( 'Crawler', id, ': failed to check application', appId, err.message )( err, callback )
                    if( result )    return self.handleTaskSkip( 'Crawler', id, ': application', appId, 'is up to date' )( callback )

                    // ** Parse application reviews
                    self.push( taskParseReviews( appId ) )

                    // ** Update or add application info
                    storage.updateApplication( appId,
                        function( err, result ) {
                            if( err ) return self.handleError( 'Crawler', id, ': failed to update application', appId, err.message )( err, callback )
                            self.handleTaskSuccess( 'Crawler', id, ': application updated [' + appId + ']' )( callback )
                        } )
                } )
        }
    }

    // ** taskParseReviews
    function taskParseReviews( appId ) {
        return function( callback ) {
            parser.parseReviews( appId,
                function( err, result ) {
                    if( err ) return self.handleError( 'Crawler', id, ': failed to parse', appId, 'reviews', err.message )( err, callback )

                    async.eachLimit( result, 50,
                        function( item, callback ) {
                            // ** Parse user
                            self.push( taskParseUser( item.userId ) )

                            // ** Add a review to a database
                            storage.updateReview( appId, item.userId, item.rating,
                                function( err, result ) {
                                    if( err ) return self.handleError( 'Crawler', id, ': failed to update user review for application', appId )( err, callback )
                                    callback()
                                } )
                        },
                        function( err, result ) {
                            if( err ) return self.handleError( 'Crawler', id, ': failed to save', appId, 'reviews', err.message )( err, callback )
                            self.handleTaskSuccess( 'Crawler', id, ': ', appId, 'reviews processed' )( callback )
                        } )
                } )
        }
    }

    // ** taskUpdateUser
    function taskUpdateUser( userId ) {
        return function( callback ) {
            storage.isUserUpToDate( userId,
                function( err, result ) {
                    if( err )       return self.handleError( 'Crawler', id, ': failed to check user', userId, err.message )( err, callback )
                    if( result )    return self.handleTaskSkip( 'Crawler', id, ': user', userId, 'is up to date' )( callback )

                    // ** No such user found - parse it and add to a data base
                    parser.parseUser( userId,
                        function( err, result ) {
                            if( err ) return self.handleError( 'Crawler', id, ': failed to parse user', userId, err.message )( err, callback )

                            // ** Save parsed user to a database
                            storage.updateUser( userId, result.name, result.actions,
                                function( err, result ) {
                                    if( err ) return self.handleError( 'Crawler', id, ': failed to save user', userId, err.message )( err, callback )
                                    self.handleTaskSuccess( 'Crawler', id, ': user', userId, 'updated' )( callback )
                                } )
                        } )
                } )
        }
    }

    // ** taskParseUser
    function taskParseUser( userId ) {
        return function( callback ) {
            storage.isUserUpToDate( userId,
                function( err, result ) {
                    if( err )       return self.handleError( 'Crawler', id, ': failed to check user', userId, err.message )( err, callback )
                    if( result )    return self.handleTaskSkip( 'Crawler', id, ': user', userId, 'is already parsed' )( callback )

                    // ** No such user found - parse it and add to a data base
                    parser.parseUser( userId,
                        function( err, result ) {
                            if( err ) return self.handleError( 'Crawler', id, ': failed to parse user', userId, err.message )( err, callback )

                            // ** Push application tasks
                            result.actions.forEach(
                                function( action ) {
                                    self.push( taskParseApplication( action.appId ) )
                                } )

                            // ** Save parsed user to a database
                            storage.updateUser( userId, result.name, result.actions,
                                function( err, result ) {
                                    if( err ) return self.handleError( 'Crawler', id, ': failed to save user', userId, err.message )( err, callback )
                                    self.handleTaskSuccess( 'Crawler', id, ': user', userId, 'updated' )( callback )
                                } )
                        } )
                } )
        }
    }

    return self
}