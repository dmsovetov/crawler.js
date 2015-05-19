var userAgent   = require( './userAgent' )
  , async       = require( 'async' )
  , cheerio     = require( 'cheerio' )
  , request     = require( 'request' )
  , qs          = require( 'querystring' )

// ** Parser
module.exports.Parser = function( callback ) {
    var self  = { token: '802250a34dbbf3e82e79a051a66433d9' }
    var host  = userAgent.create( 'http://www.kinopoisk.ru' )

    // ** setProxy
    self.setProxy = function( value, callback ) {
        host.setProxy( value ? value.host : null )
    }

    // ** getTotalReceived
    self.getTotalReceived = function() {
        return host.getTotalReceived()
    }

    // ** parseFilmInfo
    self.parseFilmInfo = function( id, callback ) {
        host.get( '/film/' + id,
            function( err, body ) {
                if( err ) return callback( err )

                var $    = cheerio.load( body )
                var name = $( 'h1.moviename-big' ).first().text()
                var desc = $( 'span._reachbanner_ .brand_words' ).text()

                callback( null, { name: name, desc: desc, image: '/images/film_big/' + id + '.jpg' } )
            } )
    }

    // ** parseInfoByName
    self.parseInfoByName = function( name, year, callback ) {
    //    '/index.php?&first=yeslevel=7&from=forma&result=adv&m_act%5Bfrom%5D=forma&m_act%5Bwhat%5D=content&m_act%5Bfind%5D=Heat&m_act%5Byear%5D=' + year
    //    '/index.php??&first=yes&level=7&from=forma&result=adv&m_act[from]=forma&m_act[what]=content&m_act[find]=' + qs.stringify( { query: name } ) + '&m_act[year]=' + year
    //    console.log( '/?first=yes&what=&kp_query=' + qs.stringify( { query: name } ) )
    //    console.log( '/index.php??&first=yes&level=7&from=forma&result=adv&m_act[from]=forma&m_act[what]=content&m_act[find]=' + qs.stringify( { query: name } ) + '&m_act[year]=' + year )
        host.get( '/index.php??&first=yes&level=7&from=forma&result=adv&m_act[from]=forma&m_act[what]=content&m_act[find]=' + qs.stringify( { query: name } ) + '&m_act[year]=' + year,
            function( err, body ) {
                if( err ) return callback( err )

                var $    = cheerio.load( body )
                var name = $( 'h1.moviename-big' ).first().text()

                if( name == '' ) {
                    console.log( body )
                }

                callback( null, name )
            } )
    }

    // ** parseUserVotes
    self.parseUserVotes = function( id, callback ) {
        var votes      = []
        var votedItems = {}

        {(function loader( page ) {
             host.get( '/user/' + id + '/votes/list/perpage/200/page/' + page,
                function( err, body ) {
                    if( err ) return callback( err )

                    var $           = cheerio.load( body )
                    var hasErrors   = false

                    // ** Parse vote items
                    $('.profileFilmsList').find( '.item' ).each(
                        function( index, element ) {
                            var rating  = parseInt( $(element).find( '.vote' ).text() )
                            var url     = $(element).find( '.nameRus' ).children('a').attr( 'href' )
                            var itemId  = extractIdFromUrl( 'film', url )

                            if( itemId == undefined ) {
                                hasErrors = true
                                return
                            }

                            if( votedItems['_' + itemId] || isNaN( rating ) ) {
                                return
                            }

                            votes.push( { userId: id, itemId: itemId, rating: rating } )
                            votedItems['_' + itemId] = rating
                        } )

                    if( hasErrors ) {
                        return callback( new Error( 'user votes parsed with errors' ) )
                    }

                    // ** Get the navigation arrows count
                    var navigationArrows = $('.navigator').find( '.arr' ).length

                    // ** If more than 2 - load next pages
                    if( navigationArrows >= 4 ) {
                        loader( page + 1 )
                    } else {
                        callback( null, votes )
                    }
                } )
        }(1))}
    }

    // ** parseFilmVotes
    self.parseFilmVotes = function( id, callback ) {
        var votes       = []
        var votedItems  = {}

        {(function loader( page, vote, order ) {
             host.post( '/handler_film_votes.php', { page: page, ajax: true, ord: order, vote: /*vote*/'', friends: '', id_film: id, token: self.token },
                function( err, body ) {
                    if( err ) return callback( err )
                    if( body == 'Safety error' ) return callback( new Error( 'Safety error' ) )

                    var $           = cheerio.load( body )
                    var hasErrors   = false

                    $('.rating_item').each(
                        function( index, element ) {
                            var rating = parseInt( $(element).find( '.comm-title' ).text().trim() )
                            var url    = $(element).find( '.profile_name' ).find( 'a' ).attr( 'href' )
                            var userId = extractIdFromUrl( 'user', url )

                            if( userId == undefined ) {
                                hasErrors = true
                                return
                            }

                            if( isNaN( rating ) || votedItems['_' + userId] ) {
                                return
                            }

                            votes.push( { itemId: id, userId: userId, rating: rating } )
                            votedItems['_' + userId] = true
                        } )

                    if( hasErrors ) {
                        return callback( new Error( 'film votes parsed with errors' ) )
                    }

                    if( page < 10 )         return loader( page + 1, vote, order )
                //    if( vote < 10 )         return loader( 1, vote + 1, order )
                //    if( order != 'login' )  return loader( 1, 1, 'login' )

                    return callback( null, votes )
                } )
        }(1, 1, 'date'))}
    }

    // ** parseTop250
    self.parseTop250 = function( callback ) {
        host.get( '/top',
            function( err, body ) {
                if( err ) return callback( err )

                var result  = []
                var $       = cheerio.load( body )

                for( var i = 1; i <= 250; i++ ) {
                    var item  = $('#top250_place_' + i)
                    var cells = item.children('td').get()
                    var url   = $(cells[1]).find('a').attr( 'href' )

                    result.push( extractIdFromUrl( 'film', url ) )
                }

                callback( null, result )
            } )
    }

    // ** extractIdFromUrl
    function extractIdFromUrl( name, url ) {
        return url ? parseInt( url.replace( '/' + name + '/', '' ).replace( '/', '' ) ) : undefined
    }

    callback( null, self )

    return self
}