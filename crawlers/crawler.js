var async   = require( 'async' )
  , log     = require( './log' )
  , worker  = require( './worker' )

// ** Crawler
module.exports.Crawler = function( id, params, proxies, taskProvider ) {
    var self = { proxy: null, isLaunched: false }

    // ** Set defaults
    params.concurrency = params.concurrency || 1
    params.delay       = params.delay       || 0

    // ** Loggers
    var error   = log.create( 'red' )
    var verbose = log.create( 'blue' )
    var success = log.create( 'yellow' )
    var message = log.create()

    // ** Tasks
    var tasks           = null
    var taskCounter     = 0
    var prevTaskCounter = 0

    // ** launch
    self.launch = function( proxy ) {
        message.print( 'Launch method is not implemented' )
    }

    // ** crawl
    self.crawl = function() {
        createWorker()
        proxies ? launchWithFreeProxy() : launchInsecure()
    }

    // ** push
    self.push = function( task ) {
        tasks.push( task )
    }

    // ** start
    self.start = function() {
        // ** Start task processing
        tasks.start()
    }

    // ** stop
    self.stop = function() {
        // ** Stop task processing
        tasks.stop()

        // ** Mark this instance as stopped
        self.isLaunched = false
    }

    // ** error
    self.error   = { print: function() { error.print( error.format( arguments ) ) } }

    // ** verbose
    self.verbose = { print: function() { verbose.print( verbose.format( arguments ) ) } }

    // ** success
    self.success = { print: function() { success.print( success.format( arguments ) ) } }

    // ** message
    self.message = { print: function() { message.print( message.format( arguments ) ) } }

    // ** handleError
    self.handleError = handleError

    // ** handleTaskSkip
    self.handleTaskSkip = handleTaskSkip

    // ** handleTaskSuccess
    self.handleTaskSuccess = handleTaskSuccess

    // ** formatProxy
    self.formatProxy = formatProxy

    // ** launchInsecure
    function launchInsecure() {
        self.launch()
    }

    // ** launchWithFreeProxy
    function launchWithFreeProxy() {
        var proxy = null

        async.whilst(
            function() {
                return proxy == null
            },
            function( callback ) {
                console.log( 'Crawler', id, ':', proxies.numFreeProxies(), 'free proxies' )

                proxy = proxies.random()
                if( proxy ) {
                    // ** Retain this proxy
                    proxies.retain( proxy )
                } else {
                    message.print( 'Crawler', id, ': no free proxy...' )
                }

                setTimeout( callback, 1000 )
            },
            function( err ) {
                self.launch( proxy )
            }
        )
    }

    // ** createWorker
    function createWorker() {
        tasks = worker.create(
            function( queue ) {
                taskProvider( queue )
            }, params.delay, params.concurrency )
    }

    // ** handleError
    function handleError() {
        // ** handleTaskCallback
        function handleTaskCallback( err, callback ) {
            // ** Push a next task
            taskProvider( tasks )

            process.nextTick(
                function() {
                    callback( err )
                } )
        }

        // ** Show error
        error.print( error.format( arguments ) )

        // ** Already stopped
        if( self.isLaunched == null || !params.restartOnError ) {
            return handleTaskCallback
        }

        // ** Stop all tasks
        self.stop()

        // ** Release used proxy
        if( self.proxy ) {
            proxies.release( self.proxy )
            self.proxy = null
        }

        var waitCounter = 6

        // ** Wait until all queued tasks are done
        async.whilst(
            function() { return tasks.hasTasksInProgress() },
            function( callback ) {
                waitCounter = waitCounter - 1

                if( waitCounter == 0 ) {
                    message.print( 'Crawler', id, ': killing the task queue...' )
                    createWorker()
                } else {
                    message.print( 'Crawler', id, ': waiting', tasks.totalTasksInProgress(), 'tasks to complete' )
                }

                setTimeout( callback, 10000 )
            },
            function( err ) {
                // ** All tasks are completed - now restart the crawler
                async.nextTick( proxies ? launchWithFreeProxy : launchInsecure )
            } )

        // ** Return a callback handler function
        return handleTaskCallback
    }

    // ** handleTaskSkip
    function handleTaskSkip() {
        // ** Show message
        verbose.print( verbose.format( arguments ) )

        // ** Push a next task
        taskProvider( tasks )

        // ** Return a callback handler function
        return function( callback ) {
            process.nextTick( callback )
        }
    }

    // ** handleTaskSuccess
    function handleTaskSuccess() {
        // ** Increase task counter
        taskCounter++

        // ** Show message
        success.print( success.format( arguments ) )

        // ** Push a next task
        taskProvider( tasks )

        // ** Return a callback handler function
        return function( callback ) {
            process.nextTick( callback )
        }
    }

    // ** formatProxy
    function formatProxy( proxy ) {
        if( !proxy ) {
            return ''
        }

        return proxy.location ? '[' + proxy.host + ' | ' + proxy.location.country_name + ']' : '[' + proxy.host + ']'
    }

    // ** showStats
    function showStats( interval ) {
        setInterval(
            function() {
                var total = self.getTotalReceived()
                var tpm   = (taskCounter - prevTaskCounter) / (interval / 60000)

                prevTaskCounter = taskCounter

                if( total > 1024 * 1024 ) total = ( total / (1024 * 1024) ).toFixed( 1 ) + 'mb'
                else if( total > 1024  )  total = ( total / 1024 ).toFixed( 1 ) + 'kb'

                message.print( 'Crawler', id, ': total traffic:', total, 'received,', tpm, 'tasks per minute' )
            }, interval )
    }

    showStats( 60000 )

    return self
}