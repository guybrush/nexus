#!/usr/bin/env node

var nexus = require('../')
  , _config
  , dnode = require('dnode')
  , _ = require('underscore')
  , fork = require('child_process').fork
  , spawn = require('child_process').spawn
  , execFile = require('child_process').execFile
  , fstream = require('fstream')
  , psTree = require('ps-tree')
  , EE2 = require('eventemitter2').EventEmitter2
  , ee2 = new EE2({wildcard:true,delimiter:'::',maxListeners: 20})
  , fs = require('fs')
  , subscriptions = {}

/****************************************************************************** /

var opts = 
 { command : 'node'
 , script : '/home/patrick/.nexus/apps/app-error@0.0.0/server.js'
 , max : 100
 }

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

/******************************************************************************/

if (!process.env.NEXUS_MONITOR) {
  process.on('message',function(data){
    process.env.NEXUS_MONITOR = true
    var child = fork(__filename,[],{env:process.env})
    child.send(data)
    child.on('message',function(m){
      process.send(m)
      process.exit(0)
    })
  })
}
else {
  delete process.env.NEXUS_MONITOR
  process.on('message',function(m){
    _config = m.config
    monitor(m.start,function(err,data){
      process.send({error:err,data:data})
      var opts = { port : _config.port
                 , host : _config.host
                 , reconnect : 500 }
      try {
        if (_config.key)
          opts.key = fs.readFileSync(_config.key)
        if (_config.cert)
          opts.cert = fs.readFileSync(_config.cert)
      } catch(e) {}
      var dnodeMonitor = dnode(data.dnodeInterface)
      dnodeMonitor.connect(opts)
      dnodeMonitor.on('error',function(err){
        if (err.code != 'ECONNREFUSED') 
          console.log(err)
      })
    })
  })
}

/******************************************************************************/

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

  self.id = null
  
  fs.readdir(_config.logs, function(err,data){
    var currIds = []
    _.each(data,function(x,i){
      var split = x.split('.')
      currIds.push(split[split.length-3])
    })
    do {
      self.id = Math.floor(Math.random()*Math.pow(2,32)).toString(16)
    } while(currIds.indexOf(self.id) != -1)
    
    start(function(){
      function server(remote, conn) {
        if (self.script == __dirname+'/server.js')
          this.type = 'NEXUS_SERVER_MONITOR'
        else
          this.type = 'NEXUS_MONITOR'
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
      info(function(err,data){
        cb(err,{dnodeInterface:server,info:data})
      })
    })
  })

  function start(cb) {
    var env = process.env
    if (opts.env) {
      for (var x in opts.env)
        env[x] = self.env[x]
    }

    // use require('npm').runScript()
    self.child = spawn( opts.command
                     , [opts.script].concat(opts.options)
                     , { cwd : opts.cwd
                       , env : env
                       } )

    ee2.emit('start', self.child.pid)
    
    self.ctime = Date.now()
    
    var logFile = opts.script
    
    if (logFile == __dirname+'/server.js')
      logFile = 'nexus_server'
    else 
      logFile = logFile.slice(_config.apps.length+1).replace(/[\/\s]/g,'_')
                       
    logFile = logFile+'.'+self.id
    
    var fsStdout = fstream.Writer({path:_config.logs+'/'+logFile+'.stdout.log',flags:'a'})
    var fsStderr = fstream.Writer({path:_config.logs+'/'+logFile+'.stderr.log',flags:'a'})
    
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
        if (self.crashed < self.max) {
          setTimeout(function(){
            start()
          },200)
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
      var timer = setTimeout(function(){
        cb('the process is unkillable :D #TODO')
      },1000)
      self.child.once('exit',function(){
        self.stopFlag = false
        clearTimeout(timer)
        info(function(err,data){
          cb && cb(err,data)
          if (!self.restartFlag) process.exit(0)
        })
      })
      process.kill(self.child.pid, 'SIGKILL')
    }
    else {
      self.stopFlag = false
      info(function(err,data){
        cb && cb(err,data)
        if (!self.restartFlag) process.exit(0)
      })
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

