#!/usr/bin/env node

var nexus = require('../')
  , dnode = require('dnode')
  , fork = require('child_process').fork
  , spawn = require('child_process').spawn
  , psTree = require('ps-tree')
  , EE2 = require('eventemitter2').EventEmitter2
  , ee2 = new EE2({wildcard:true,delimiter:'::',maxListeners: 20})
  , dnodeMonitor

if (!process.env.NEXUS_MONITOR) {
  console.log('monitor-parent> going to start monitor-child')
  process.on('message',function(data){
    console.log('monitor-parent> get message from parent',data)
    process.env.NEXUS_MONITOR = true
    var child = fork(__filename,[],{env:process.env})
    child.send(data)
    child.on('message',function(m){
      console.log('monitor-parent> get message from child',m)
      process.send(m)
      process.exit()
    })
  })
}
else {
  console.log('monitor-child> here we go')
  process.on('message',function(m){
    console.log('monitor-child> get message from parent',m)
    monitor(m,function(s){
      process.send({data:{pid:process.pid}})
      dnodeMonitor = dnode(s)
      dnodeMonitor.connect(5000,{reconnect:100})
      dnodeMonitor.on('error',function(err){
        if (err.code != 'ECONNREFUSED') console.log(err)
      })
    })
  })
}


function monitor(opts, cb) {
  var self = this
  
  self.subscriptions = {}
  self.crashed = 0
  self.ctime = Date.now()
  self.env = opts.env
  self.restartFlag = false
  self.child = null
  
  start(function(){
    function server(remote, conn) {
      this.type = 'NEXUS_MONITOR'
      this.monitorPid = process.pid
      this.pid = self.child.pid
      this.crashed = self.crashed
      this.ctime = self.ctime
      this.restart = restart
      this.stop = stop
      this.subscribe = function(event, cb) {
        self.subscriptions[conn.id] = 
          self.subscriptions[conn.id] || {events:[],emit:null}
        if (self.subscriptions[conn.id].events.indexOf(event) != -1)
          self.subscriptions[conn.id].events.push(event)
        self.subscriptions[conn.id].emit = cb
      }
      this.unsubscribe = function(cb) {
        delete self.subscriptions[conn.id]
        cb()
      }
    }
    cb(server)
  })
  
  function start(cb) {
    
    delete process.env.NEXUS_MONITOR
    var env = process.env
    if (opts.env) {
      for (var x in opts.env)
        env[x] = opts.env[x]
    }
    
    self.child = spawn( opts.command
                      , [opts.script].concat(opts.options)
                      , ['server.js']
                      , { cwd : opts.cwd
                        , env : env
                        } )
    
    self.child.stdout.on('data',function(data){
      ee2.emit('stdout', data.toString())
    })
    self.child.stderr.on('data',function(data){
      ee2.emit('stderr', data.toString())
    })
    self.child.on('exit',function(code){
      ee2.emit('exit', code)
      if (code != 0) {
        self.crashed++
        if (self.restart) {
          if (self.crashed <= 10) {
            restart()
          }
        }
      }
    })
    cb && cb()
  }
  
  function restart() {
    self.restartFlag = true
    stop(function(){start(function(){self.restartFlag = false})})
  }
  
  function stop(cb) {
    psTree(self.child.pid, function (err, children) {
      spawn('kill', ['-9'].concat(children.map(function (p) {return p.PID})))
    })
    cb && cb()
    if (!self.restartFlag) {
      dnodeMonitor && dnodeMonitor.destroy()
      process.exit(0)
    }
  }
}

