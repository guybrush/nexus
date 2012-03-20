#!/usr/bin/env node

var fs = require('fs')
  , dnode = require('dnode')
  , AA = require('async-array')
  , _config = JSON.parse(process.env.NEXUS_CONFIG)
  , nexus = require('../nexus')
  , opts = { port : _config.port
           , host : _config.host }

var title = 'nexus-server'
if (_config.port) title = title+':'+_config.port
if (_config.socket) title = title+':'+_config.socket
process.title = title
           
console.log('starting server',_config)
           
if (_config.key) {
  try {
    opts.key = fs.readFileSync(_config.key)
  } catch(e) {
    console.error('could not use key-file '+_config.key)
  }
}

if (_config.cert) {
  try {
    opts.cert = fs.readFileSync(_config.cert)
  } catch(e) {
    console.error('could not use cert-file '+_config.cert)
  }
}

if (_config.ca) {
  fs.readdir(_config.ca,function(err,data){
    if (data.length > 0) {
      opts.requestCert = true
      opts.rejectUnauthorized = true
      new AA(data).map(function(x,i,next){
        fs.readFile(_config.ca+'/'+x,next)
      }).done(function(err, data){
        if (err)
          console.error('could not add cert-files to ca',err)
        opts.ca = data
        start()
      }).exec()
    } else {
      start()
    }
  })
}
else {
  start()
}

function start() {
  if (_config.socket) {
    var unixServer = dnode(nexus(_config)).listen(_config.socket)
    unixServer.on('ready',function(){
      console.log('started unix-server '+_config.socket)
      var client = dnode({type:'NEXUS_PROXY'})
      client.connect(_config.socket,function(rem,conn){
        var server = dnode(rem).listen(opts)
        server.on('error',function(err){
          console.error(err)
        })
        server.on('ready',function(){
          console.log('started server')
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
  var server = dnode(nexus(_config)).listen(opts)
  server.on('error',function(err){
    console.error(err)
  })
  server.on('ready',function(){
    console.log('started server')
  })
}
