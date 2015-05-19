var async = require( 'async' )

// ** create
module.exports.create = function( fetch, delay, concurrency )
{
    // ** Set default concurrency
    concurrency = concurrency ? concurrency : 1

    var self = { queue: null }

    // ** start
    self.start = function() {
        self.queue.resume()
    }

    // ** stop
    self.stop = function() {
        self.queue.pause()
    }

    // ** length
    self.length = function() {
        return self.queue.length() + self.queue.running()
    }

    // ** load
    self.load = function() {
        if( fetch ) {
            fetch( self )
        }
    }

    // ** release
    self.release = function() {
        self.queue.kill()
    }

    // ** hasTasksInProgress
    self.hasTasksInProgress = function() {
        return self.queue.running() > 0
    }

    // ** totalTasksInProgress
    self.totalTasksInProgress = function() {
        return self.queue.running()
    }

    // ** push
    self.push = function( task, success, error ) {
        self.pushWithCallback( task,
            function( err ) {
                if( err ) return error ? console.log( error.red, err ) : null
                return success ? console.log( success ) : null
            } )
    }

    // ** pushFront
    self.pushFront = function( task, success, error ) {
        self.queue.unshift( task,
            function( err ) {
                if( err ) return error ? console.log( error.red, err ) : null
                return success ? console.log( success ) : null
            } )
    }

    // ** pushWithCallback
    self.pushWithCallback = function( task, callback ) {
        self.queue.push( task, callback )
    }

    // ** Create queue
    self.queue = async.queue(
        function( task, callback ) {
            task( callback )
        }, concurrency )

    self.queue.drain = function() {
        setTimeout(
            function() {
                self.load()
            }, delay )
    }

    // ** Preload worker
    self.stop()
    self.load()

    return self
}