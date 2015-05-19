var async   = require( 'async' )
  , Crawler = require( './crawler' ).Crawler
  , Storage = require( './storage/kinopoisk' ).Storage
  , Parser  = require( './parsers/kinopoisk' ).Parser

// ** create
module.exports.create = function( params, proxies ) {
    var self    = Crawler( 'Kinopoisk', params, proxies, providerProcessDiscovered )

    var storage     = null
    var parser      = null

    // ** Stats
    var prevStats           = null
    var votesPerMinute      = 0
    var discoveredPerMinute = 0

    // ** Launch crawler
    Parser(
        function( err, result ) {
            if( err ) return console.log( err )

            parser = result
/*
            // **
            var mongo = require( './storage/mongo' )
            mongo.connect( 'mongodb://dm.local/movielens',
                function( err, result ) {
                    var items = mongo.collection( "items" )
                    items.find( { query: { 'name.ru': { $eq: null } } },
                        function( err, result ) {
                            async.eachLimit( result, 10,
                                function( item, callback ) {
                                    var nameEn = item.name.en ? item.name.en.replace( ' (' + item.year + ')', '' ) : item.name.replace( ' (' + item.year + ')', '' )

                                    parser.setProxy( proxies ? proxies.random() : null )
                                    parser.parseInfoByName( nameEn, item.year,
                                        function( err, nameRu ) {
                                            if( err ) return callback( err )
                                            if( nameRu == '' ) return callback( err )

                                            items.update( { _id: item._id }, { $set: { name: { en: nameEn, ru: nameRu }, search: { en: nameEn.toUpperCase(), ru: nameRu.toUpperCase() } } }, callback )
                                            console.log( item.name, '->', nameRu )
                                            callback()
                                        } )
                                },
                                function( err ) {
                                    console.log( 'done' )
                                } )
                        } )
                } )
            // **
        //*/

            Storage(
                function( err, result ) {
                    storage = result

                    if( 0 ) {
                        parser.parseTop250( function( err, result ) { result.forEach( function( item ) { storage.discoverItem( item ) } ) } )
                    } else {
                        self.crawl()
                    }
                } )
        } )

    // ** getTotalReceived
    self.getTotalReceived = function() {
        return parser ? parser.getTotalReceived() : 0
    }

    // ** launch
    self.launch = function( proxy ) {
        self.message.print( 'Kinopoisk : starting crawler', self.formatProxy( proxy ) )

        self.isLaunched = true
        self.proxy      = proxy
        self.start()
    }

    // ** providerProcessDiscovered
    function providerProcessDiscovered( queue ) {
        var items = []

        async.times( params.concurrency - queue.length(),
            function( n, next ) {
                storage.randomDiscovered( next )
            },
            function( err, results ) {
                if( err ) return self.error.print( 'Kinopoisk : failed to load random discovered item', err.message )

                results = results.filter( function( item ) { return item } )

                results.forEach(
                    function( item ) {
                        if( item.type == 'user' ) {
                            queue.push( taskParseUser( item.itemId ) )
                        } else {
                            queue.push( taskParseFilm( item.itemId ) )
                        }
                    } )
            } )
    }

    // ** taskParseUser
    function taskParseUser( userId ) {
        return function( callback ) {
            // ** Check user up-to-date
            storage.isUserUpToDate( userId,
                function( err, upToDate ) {
                    if( err )       return self.handleError( 'Kinopoisk : failed to check user up-to-date', userId, err.message )( err, callback )
                    if( upToDate )  return self.handleTaskSkip( 'Kinopoisk : user', userId, 'is up to date' )( callback )

                    // ** Set random proxy
                    parser.setProxy( proxies ? proxies.random() : null )

                    // ** Parse user votes
                    parser.parseUserVotes( userId,
                        function( err, votes ) {
                            if( err ) return self.handleError( 'Kinopoisk : failed to parse user votes', userId, err.message )( err, callback )

                            // ** Store parsed votes
                            storage.storeUserVotes( userId, votes,
                                function( err ) {
                                    if( err ) return self.handleError( 'Kinopoisk : failed to store user votes', userId, err.message )( err, callback )
                                    else      return self.handleTaskSuccess( 'Kinopoisk : user processed [' + userId + ']', number( votes.length, 'votes' ) )( callback )
                                } )
                        } )
                } )
        }
    }

    // ** taskParseFilm
    function taskParseFilm( itemId ) {
        return function( callback ) {
            // ** Check film up-to-date
            storage.isItemUpToDate( itemId,
                function( err, upToDate ) {
                    if( err )       return self.handleError( 'Kinopoisk : failed to check item up-to-date', itemId, err.message )( err, callback )
                    if( upToDate )  return self.handleTaskSkip( 'Kinopoisk : item', itemId, 'is up to date' )( callback )

                    // ** Set random proxy
                    parser.setProxy( proxies ? proxies.random() : null )

                    // ** Parse film votes
                    parser.parseFilmVotes( itemId,
                        function( err, votes ) {
                            if( err ) return self.handleError( 'Kinopoisk : failed to parse film', itemId, err.message )( err, callback )

                            // ** Store parsed votes
                            storage.storeItemVotes( itemId, votes,
                                function( err ) {
                                    if( err ) return self.handleError( 'Kinopoisk : failed to store item votes', itemId, err.message )( err, callback )
                                    else      return self.handleTaskSuccess( 'Kinopoisk : item processed [' + itemId + ']', number( votes.length, 'votes' ) )( callback )
                                } )
                        } )
                } )
        }
    }

    // ** number
    function number( num, caption ) {
        var formatted = null

             if( num > 999999 ) formatted = ( num / 1000000 ).toFixed( 1 ) + 'm'
        else if( num > 999    ) formatted = ( num / 1000    ).toFixed( 1 ) + 'k'
        else                    formatted =   num

        return (num > 0 ? '+' : '') + formatted + (caption ? ' ' + caption : '')
    }

    // ** showStats
    function showStats( interval ) {
        setInterval(
            function() {
                storage.getStats(
                    function( err, stats ) {
                        if( err ) return
                        if( prevStats && stats ) {
                            var votes       = stats.votes - prevStats.votes
                            var discovered  = stats.discovered - prevStats.discovered

                            votesPerMinute      = votesPerMinute      ? (votesPerMinute + votes) * 0.5           : votes
                            discoveredPerMinute = discoveredPerMinute ? (discoveredPerMinute + discovered) * 0.5 : discovered

                            var daysLeft        = stats.discovered / (Math.abs( discoveredPerMinute ) * 60 * 24)
                            var votesEstimate   = votesPerMinute * (daysLeft * 24 * 60)

                            self.message.print( 'Kinopoisk :', Math.floor( daysLeft ), 'days left', number( stats.votes + Math.floor( votesEstimate ), 'votes in total' ), number( votesPerMinute, 'votes per minute' ), number( discoveredPerMinute, 'discovered per minute' ) )
                        }

                        prevStats = stats
                    } )
            }, interval )
    }

    showStats( 60000 )

    return self
}