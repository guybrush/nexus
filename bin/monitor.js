#!/usr/bin/env node

var nexus = require('../')
  , _config = nexus.config()
  , dnode = require('dnode')
  , _ = require('underscore')
  , fork = require('child_process').fork
  , spawn = require('child_process').spawn
  , execFile = require('child_process').execFile
  , psTree = require('ps-tree')
  , EE2 = require('eventemitter2').EventEmitter2
  , ee2 = new EE2({wildcard:true,delimiter:'::',maxListeners: 20})
  , subscriptions = {}

/****************************************************************************** /
// #FORKISSUE
// https://groups.google.com/forum/#!topic/nodejs-dev/SS3CCcODKgI
// https://github.com/joyent/node/issues/2254
if (!process.env.NEXUS_MONITOR) {
  process.on('message',function(data){
    process.env.NEXUS_MONITOR = true
    var child = fork(__filename,[],{env:process.env})
    child.send(data)
    child.on('message',function(m){
      process.send(m)
      process.exit()
    })
  })
}
else {
  delete process.env.NEXUS_MONITOR
  process.on('message',function(m){
    monitor(m,function(s){
      process.send({data:{pid:process.pid}})
      var dnodeMonitor = dnode(s)
      dnodeMonitor.connect(5000,{reconnect:100})
      dnodeMonitor.on('error',function(err){
        if (err.code != 'ECONNREFUSED') console.log(err)
      })
    })
  })
}
/******************************************************************************/

if (!process.env.NEXUS_MONITOR) {
  process.env.NEXUS_MONITOR = true
  var child = spawn('node',[__filename],{env:process.env})
  child.stdout.on('data',function(d){console.log('monitorP-stdout> '+d)})
  //child.stderr.on('data',function(d){console.log('monitorP-stderr> '+d)})
  console.log({monitorPid:child.pid})
  // process.exit(0)
}
else {
  var opts = JSON.parse(process.env.NEXUS_MONITOR_DATA)
  delete process.env.NEXUS_MONITOR
  delete process.env.NEXUS_MONITOR_DATA
  process.title = 'nexus-monitor'
  monitor(opts, function(s) {
    var dnodeMonitor = dnode(s)
    var opts = { port : _config.port
               , host : _config.host
               , reconnect : 500 }
    dnodeMonitor.connect(opts)
    dnodeMonitor.on('error',function(err){
      if (err.code != 'ECONNREFUSED') console.log(err)
    })
  })
}

ee2.onAny(function(data){
  var self = this
  _.each(subscriptions,function(x,i){
    x(self.event,data)
  })
})

function monitor(opts, cb) {
  
  var self = this

  self.crashed = 0
  self.ctime = 0
  self.env = opts.env
  self.package = opts.package
  self.script = opts.script
  self.options = opts.options
  self.child = null
  self.command = opts.command
  self.max = opts.max
  self.restartFlag = false
  self.stopFlag = false
  self.env = opts.env

  start(function(){
    function server(remote, conn) {
      this.type = 'NEXUS_MONITOR'
      this.info = info
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
    cb(server)
  })

  function start(cb) {
    var env = process.env
    if (opts.env) {
      for (var x in opts.env)
        env[x] = self.env[x]
    }

    self.child = spawn( opts.command
                     , [opts.script].concat(opts.options)
                     , { cwd : opts.cwd
                       , env : env
                       } )

    self.ctime = Date.now()

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
        if (self.crashed < self.max) {
          start()
        }
      }
    })
    cb && info(cb)
  }

  function restart(cb) {
    self.crashed = 0
    self.restartFlag = true
    stop(function(){
      setTimeout(function(){
        self.restartFlag = false
        start(cb)
      },200)
    })
  }

  function stop(cb) {
    self.stopFlag = true
    if (self.child && self.child.pid) {
      var pid = self.child.pid
      var timer = setTimeout(function(){cb('the process is unkillable :D #TODO')},1000)
      self.child.once('exit',function(){
        self.stopFlag = false
        clearTimeout(timer)
        cb && info(cb)
        if (!self.restartFlag) process.exit(0)
      })
      process.kill(self.child.pid, 'SIGKILL')
    }
    else {
      cb && info(cb)
      if (!self.restartFlag) process.exit(0)
    }
  }

  function info(cb) {
    cb( null
      , { monitorPid : process.pid
        , pid : self.child ? self.child.pid : null
        , crashed : self.crashed
        , ctime : self.ctime
        , package : self.package
        , script : self.script
        , options : self.options
        , command : self.command
        , env : self.env
        , max : self.max
        , running : self.child ? true : false
        } )
  }
  
}

