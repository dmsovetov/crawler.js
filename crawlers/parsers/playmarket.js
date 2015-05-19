var userAgent   = require( './userAgent' )
  , cheerio     = require( 'cheerio' )
  , request     = require( 'request' )
  , fs          = require( 'fs' )

// ** create
module.exports.create = function( language ) {
    var self  = {}
    var ua    = userAgent.random()
    var host  = userAgent.create( 'https://play.google.com' )
    var login = userAgent.create( 'https://accounts.google.com' )

    // ** setProxy
    self.setProxy = function( value ) {
        host.setProxy( value ? value.host : null )
        login.setProxy( value ? value.host : null )
    }

    // ** parseReviews
    self.parseReviews = function( identifier, callback ) {
        var result = []
        var users  = []

        function load( page ) {
            host.post( '/store/getreviews?hl=' + language, { id: identifier, pageNum: page, reviewType: 0 },
                function( err, body ) {
                    if( err ) return callback( err )

                    // ** Check captcha
                    if( hasCaptcha( body ) ) return callback( new Error( 'google captcha' ) )

                    var $       = cheerio.load( normalizeResponse( body ) )
                    var reviews = []
                    var loaded  = false

                    $( '.single-review' ).each(
                        function( index, element ) {
                            var rating  = { '100%': 5, '80%': 4, '60%': 3, '40%': 2, '20%': 1 }
                            var style   = $(element).find( '.current-rating' ).attr( 'style' ).split( ': ' )[1]
                            var author  = $(element).find( '.author-name' ).text()
                            var profile = $(element).find( '.author-name' ).find( 'a' ).attr( 'href' )

                            if( !profile ) {
                                return
                            }

                            if( users.indexOf( author ) != -1 ) {
                                loaded = true
                            }

                            users.push( author )
                            reviews.push( { rating: rating[style], author: author.trim(), userId: profile.substr( profile.indexOf( '=' ) + 1 ) } )
                        } )

                    if( loaded ) {
                        return callback( null, result )
                    }

                    // ** Load the next page
                    result = result.concat( reviews )
                    load( page + 1 )
                } )
        }

        load( 0 )
    }

    // ** parseUser
    self.parseUser = function( id, callback ) {
        host.get( '/store/people/details?id=' + id,
            function( err, body ) {
                if( err ) return callback( err )

                // ** Check captcha
                if( hasCaptcha( body ) ) return callback( new Error( 'google captcha' ) )

                var $       = cheerio.load( body )
                var user    = { name: null, actions: [] }

                user.name = $( '.person-name' ).text()

                $('.card.one-rationale.square-cover.apps.medium' ).each(
                    function( index, element ) {
                        var appId  = $(element).attr( 'data-docid' )
                        var title  = $(element).find( 'a.title' ).text().trim()
                        var reason = $(element).find( '.reason-body' ).text()
                        var rating = parseInt( reason[reason.length - 1] )

                        if( reason[reason.length - 2] == '+' ) {
                            return
                        }

                        user.actions.push( { appId: appId, title: title, rating: rating } )
                    } )

                callback( err, user )
            } )
    }

    // ** passLoginChallenge
    self.passLoginChallenge = function( body, callback ) {
        var form = parseForm( body, { address: 'Харьков' } )

        console.log( 'Sending verification...' )
        host.post( form.action, form.params,
            function( err, body ) {
                if( err ) return callback( err )
                console.log( 'Verification sent' )
                callback( err, null )
            } )
    }

    // ** signin
    self.signin = function( email, password, callback ) {
        host.get( 'https://accounts.google.com/ServiceLogin',
            function( err, body ) {
                if( err ) return callback( err )

                var form = parseForm( body, { Email: email, Passwd: password } )

                host.post( form.action, form.params,
                    function( err, body ) {
                        if( err ) return callback( err )

                        if( hasLoginForm( body ) ) return callback( new Error( 'login failed' ) )
                        if( hasLoginChallenge( body ) ) return self.passLoginChallenge( body, callback )

                        // ** Run a callback
                        callback()
                    } )
            } )
    }

    // ** hasCaptcha
    function hasCaptcha( body ) {
        return body && body.indexOf( 'CaptchaRedirect' ) != -1
    }

    function hasLoginForm( body ) {
        return body && body.indexOf( 'https://accounts.google.com/ServiceLoginAuth' ) != -1
    }

    // ** hasLoginChallenge
    function hasLoginChallenge( body ) {
        return body && body.indexOf( 'id="login-challenge-heading"' ) != -1
    }

    // ** parseForm
    function parseForm( body, input ) {
        var $       = cheerio.load( body )
        var form    = $( 'form' )
        var params  = {}

        form.find( 'input' ).each(
            function( index, element ) {
                if( $(element).attr( 'type' ) == 'submit' ) {
                    return
                }

                params[$(element).attr( 'name' )] = $(element).attr( 'value' )
            } )

        if( input ) {
            for( var key in input ) {
                if( input.hasOwnProperty( key ) ) {
                    params[key] = input[key]
                }
            }
        }

        return { action: form.attr( 'action' ), method: form.attr( 'method' ), params: params }
    }

    // ** normalizeResponse
    function normalizeResponse( body ) {
        var replacements = [
            { replaceBy: '<', string: '\\u003c'     },
            { replaceBy: '=', string: '\\u003d'     },
            { replaceBy: '>', string: '\\u003e'     },
            { replaceBy: '&', string: '\\u0026amp;' },
            { replaceBy: '"', string: '\\"'         },
        ]

        for( var i = 0; i < replacements.length; i++ ) {
            var string    = replacements[i].string
            var replaceBy = replacements[i].replaceBy

            while( body.indexOf( string ) != -1 ) {
                body = body.replace( string, replaceBy )
            }
        }

        body = body.substring( body.indexOf( '<div' ), body.lastIndexOf( ' ",' ) )

        return body
    }

    return self
}