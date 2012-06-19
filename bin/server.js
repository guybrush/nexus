#!/usr/bin/env node

var fs = require('fs')
  , dnode = require('dnode')
  , AA = require('async-array')
  , dirty = require('dirty')
  , config = JSON.parse(process.env.NEXUS_CONFIG)
  , nexus = require('../nexus')(config)
  , opts = { port : config.port
           , host : config.host }

var title = 'nexus-server'
if (config.port) title = title+':'+config.port
if (config.socket) title = title+':'+config.socket
process.title = title

readKeys(function(err){
  startServer(function(err, remote){
    var dbPath = config.socket
                 ? config.dbs+'/'+(config.socket.replace(/\//g,'_'))
                 : config.dbs+'/'+config.port
    initDb(dbPath,process.env.NEXUS_REBOOT,remote,function(err){
      if (err) console.log('err:',err)
    })
  })
})

function readKeys(cb) {
  if (config.key) {
    try {
      opts.key = fs.readFileSync(config.key)
    } catch(e) {
      throw new Error('could not use key-file '+config.key)
    }
  }

  if (config.cert) {
    try {
      opts.cert = fs.readFileSync(config.cert)
    } catch(e) {
      throw new Error('could not use cert-file '+config.cert)
    }
  }

  if (config.ca) {
    fs.readdir(config.ca,function(err,data){
      if (data.length > 0) {
        opts.requestCert = true
        opts.rejectUnauthorized = true
        new AA(data).map(function(x,i,next){
          fs.readFile(config.ca+'/'+x,next)
        }).done(function(err, data){
          if (err)
            throw new Error('could not add cert-files to ca',err)
          opts.ca = data
          cb()
        }).exec()
      } else {
        cb()
      }
    })
  }
  else {
    cb()
  }
}

function initDb(dbPath,rebootFlag,remote,cb) {
  var db
  var todo = [unlinkDb,loadDb,subCon,subDis]
  if (rebootFlag) todo.unshift(reboot)

  new AA(todo).forEachSerial(function(x,i,next){x(next)}).done(cb).exec()

  function reboot(cb) {
    var db = dirty(dbPath).on('load',function(err){
      if (err) cb(err)
      db.forEach(function(k,v){
        console.log('rebooting',v)
        nexus.start(v)
      })
      cb()
    })
  }

  function unlinkDb(cb) {
    fs.exists(dbPath,function(exists){
      if (exists) return fs.unlink(dbPath,cb)
      cb()
    })
  }

  function loadDb(cb) {
    db = dirty(dbPath).on('load',cb)
  }

  function subCon(cb) {
    remote.subscribe('monitor::*::connected',function(ev){
      var id = ev.split('::')[1]
      remote.ps(id,function(err,d){
        if (err) return
        delete d[id].env.NEXUS_MONITOR_ID
        console.log('saving to db',id)
        db.set(id, { options : d[id].options
                   , script  : d[id].script
                   , name    : d[id].name
                   , env     : d[id].env
                   , command : d[id].command
                   , max     : d[id].max } )
      })
    },cb)
  }

  function subDis(cb) {
    remote.subscribe('monitor::*::disconnected',function(ev){
      var id = ev.split('::')[1]
      console.log('deleting from db',id)
      db.rm(id)
    },cb)
  }
}

function startServer(cb) {
  if (config.socket) {
    var unixServer = dnode(nexus).listen(config.socket)
    unixServer.on('ready',function(){
      console.log('started unix-server '+config.socket)
      var client = dnode({type:'NEXUS_PROXY'})
      client.connect(config.socket,function(rem,conn){
        var server = dnode(rem).listen(opts)
        server.on('error',function(err){
          console.error(err)
        })
        server.on('ready',function(){
          cb(null,rem)
        })
      })
      client.on('error',function(e){
        console.error(e)
      })
    })
    unixServer.on('error',function(err){
      console.error(err)
    })
    return
  }
  var server = dnode(nexus).listen(opts)
  server.on('error',function(err){
    console.error(err)
  })
  server.on('ready',function(){
    console.log('started server',opts)
    var client = dnode({type:'NEXUS_PROXY'})
    var clientOpts = {port:opts.port,host:opts.host,key:opts.key,cert:opts.cert}
    client.connect(clientOpts,function(rem,conn){
      cb(null,rem)
    })
  })
}

