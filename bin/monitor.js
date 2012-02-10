#!/usr/bin/env node

// cli-options:
//
// -c <JSON.stringified-nexusConfig>
// -s <JSON.stringified-startOptions>
// -i <id>

var nexus = require('../')
  , _config
  , dnode = require('dnode')
  , _ = require('underscore')
  , opti = require('optimist')
  , spawn = require('child_process').spawn
  , fstream = require('fstream')
  , psTree = require('ps-tree')
  , EE2 = require('eventemitter2').EventEmitter2
  , ee2 = new EE2({wildcard:true,delimiter:'::',maxListeners: 20})
  , fs = require('fs')
  , subscriptions = {}
  , debug = require('debug')('nexus')

process.title = 'nexus-monitor-starter('+opti.argv.c+')'

if (!process.env.NEXUS_MONITOR) {
  process.env.NEXUS_MONITOR = true
  _config = JSON.parse(opti.argv.c)
  var startOpts = JSON.parse(opti.argv.s)
  var clientOpts = { port : _config.port
                   , host : _config.host
                   , reconnect : 100 }

  try {
    if (_config.key)
      clientOpts.key = fs.readFileSync(_config.key)
    if (_config.cert)
      clientOpts.cert = fs.readFileSync(_config.cert)
  }
  catch (e) {
    throw e
  }
  var to = setTimeout(function(){
    console.error('monitor could not connect in 5seconds')
    process.exit(0)
  },5000)
  var monitorStarterClient = 
    dnode({type:'NEXUS_MONITOR_STARTER'
          ,id:opti.argv.i})
      .connect(clientOpts,function(r,c){
        r.subscribe('monitor::'+opti.argv.i+'::connected',function(){
          clearTimeout(to)
          process.exit(0)
        })
      })
  monitorStarterClient.on('error',function(err){
    if (err.code != 'ECONNREFUSED') console.error(err)
  })
  var child = spawn( 'node'
                   , [ __filename
                     , '-c', opti.argv.c
                     , '-s', opti.argv.s 
                     , '-i', process.argv[process.argv.indexOf('-i')+1] 
                     ]
                   , { env : process.env } )
  child.stdout.on('data',function(d){debug('monitorChild-stdout',d.toString())})
  child.stderr.on('data',function(d){debug('monitorChild-stderr',d.toString())})
}
else {
  _config = JSON.parse(opti.argv.c)
  process.title = 'nexus-monitor('+process.argv[process.argv.indexOf('-i')+1]+'):'+_config.port
  delete process.env.NEXUS_MONITOR
  
  var startOpts = JSON.parse(opti.argv.s)
  var clientOpts = { port : _config.port
                   , host : _config.host
                   , reconnect : 100 }

  try {
    if (_config.key)
      clientOpts.key = fs.readFileSync(_config.key)
    if (_config.cert)
      clientOpts.cert = fs.readFileSync(_config.cert)
  }
  catch (e) {
    throw e
  }
  var monitorClient = dnode(monitor(startOpts))
  monitorClient.connect(clientOpts)
  monitorClient.on('error',function(err){
    if (err.code != 'ECONNREFUSED') console.log(err)
  })
}

ee2.onAny(function(data){
  var self = this
  _.each(subscriptions,function(x,i){
    x(self.event,data)
    //debug(self.event,'→',data)
  })
})

//------------------------------------------------------------------------------
//                                                        monitor (constructor)
//------------------------------------------------------------------------------

function monitor(startOpts) {

  var self = this

  self.id = process.argv[process.argv.indexOf('-i')+1]
  self.crashed = 0
  self.ctime = 0
  self.name = startOpts.name
  self.package = startOpts.package
  self.script = startOpts.script
  self.options = startOpts.options
  self.child = null
  self.command = startOpts.command
  self.max = startOpts.max
  self.restartFlag = false
  self.stopFlag = false
  self.env = startOpts.env
  self.restartTimeout = 200
  self.env = startOpts.env
  
  var logFile = self.script
  
  if (logFile == __dirname+'/server.js') {
    logFile = 'nexus_server'
  }
  else if (logFile.slice(0,_config.apps.length) == _config.apps) {
    logFile = logFile.slice(_config.apps.length+1)
  }
  
  logFile = logFile.replace(/[\/\s]/g,'_')+'.'+self.id
  
  self.logScriptStdout = _config.logs+'/'+logFile+'.stdout.log'
  self.logScriptStderr = _config.logs+'/'+logFile+'.stderr.log'
  self.logMonitorStdout = _config.logs+'/'+logFile+'.monitor.stdout.log'
  self.logMonitorStderr = _config.logs+'/'+logFile+'.monitor.stderr.log'

  process.stdout.pipe(fstream.Writer({path:self.logMonitorStdout,flags:'a'}))
  process.stderr.pipe(fstream.Writer({path:self.logMonitorStderr,flags:'a'}))
  
  if (self.script == __dirname+'/server.js')
    self.type = 'NEXUS_SERVER_MONITOR'
  else
    self.type = 'NEXUS_MONITOR'
  
  if (self.type == 'NEXUS_SERVER_MONITOR')
    start()
  
  return client

//------------------------------------------------------------------------------
//                                                        client
//------------------------------------------------------------------------------

  function client(remote, conn) {
    debug('CONNECTED TO SERVER')
    this.type = self.type
    this.info = info
    this.id = self.id
    this.start = start
    this.restart = restart
    this.stop = stop
    this.subscribe = function(emit, cb) {
      subscriptions[conn.id] = emit
      cb && cb()
    }
    this.unsubscribe = function(cb) {
      delete subscriptions[conn.id]
      cb && cb()
    }
  }

//------------------------------------------------------------------------------
//                                                        start
//------------------------------------------------------------------------------

  function start(cb) {
    debug('STARTING')
    var env = process.env
    if (self.env) {
      for (var x in self.env)
        env[x] = self.env[x]
    }
    self.child = spawn( self.command
                      , [self.script].concat(self.options)
                      , { cwd : self.cwd
                        , env : env
                        } )

    ee2.emit('start', self.child.pid)

    self.ctime = Date.now()
    var fsStdout = fstream.Writer({path:self.logScriptStdout,flags:'a'})
    var fsStderr = fstream.Writer({path:self.logScriptStderr,flags:'a'})
    self.child.stdout.pipe(fsStdout)
    self.child.stderr.pipe(fsStderr)

    self.child.stdout.on('data',function(data){
      ee2.emit('stdout', data.toString())
    })
    self.child.stderr.on('data',function(data){
      ee2.emit('stderr', data.toString())
    })
    self.child.once('exit',function(code){
      ee2.emit('exit', code)
      self.child = null
      if ((code != 0) && !self.stopFlag) {
        self.crashed++
        if (!self.max || self.crashed < self.max) {
          if ((Date.now()-self.ctime) > 5000)
            self.restartTimeout = 200
          else if (self.restartTimeout < 4000)
            self.restartTimeout += 100
          setTimeout(function(){
            start()
          },self.restartTimeout)
        }
      }
    })
    cb && info(cb)
  }

//------------------------------------------------------------------------------
//                                                        restart
//------------------------------------------------------------------------------

  function restart(cb) {
    debug('monitor'+[self.id]+' restarting childprocess')
    self.crashed = 0
    self.restartFlag = true
    stop(function(){
      setTimeout(function(){
        self.restartFlag = false
        start(cb)
      },200)
    })
  }

//------------------------------------------------------------------------------
//                                                        stop
//------------------------------------------------------------------------------

  function stop(cb) {
    ee2.emit('debug','stopping')
    self.stopFlag = true
    info(function(err,data){
      if (err) return cb(err)
      if (data.running) {
        var timer = setTimeout(function(){
          cb('tried to kill process (pid:'+data.pid+') but it did not exit yet')
        },4000)
        self.child.once('exit',function(){
          ee2.emit('debug','child exitted')
          self.stopFlag = false
          clearTimeout(timer)
          info(function(err,data){
            cb && cb(err,data)
            if (!self.restartFlag) process.exit(0)
          })
        })
        // process.kill(self.child.pid)
        psTree(data.pid, function(err, children){
          if (err) return cb(err)
          var pids = children.map(function (p) {return p.PID})
          pids.unshift(data.pid)
          spawn('kill', ['-9'].concat(pids)).on('exit',function(){})
        })
      }
      else {
        self.stopFlag = false
        cb(err,data)
        if (!self.restartFlag) process.exit(0)
      }
    })
  }

//------------------------------------------------------------------------------
//                                                        info
//------------------------------------------------------------------------------

  function info(cb) {
    var now = Date.now()
      , uptime = now-self.ctime
    cb( null
      , { id : self.id
        , running : self.child ? true : false
        , crashed : self.crashed
        , name : self.name
        , command : self.command
        , script : self.script
        , logScriptStdout : self.logScriptStdout
        , logScriptStderr : self.logScriptStderr
        , logMonitorStdout : self.logMonitorStdout
        , logMonitorStderr : self.logMonitorStderr
        , package : self.package
        , monitorPid : process.pid
        , pid : self.child ? self.child.pid : null
        , ctime : self.ctime
        , uptime : uptime
        , options : self.options
        , env : self.env
        , max : self.max
        } )
  }
  
}

