#!/usr/bin/env node

var fs = require('fs')
  , dnode = require('dnode')
  , AA = require('async-array')
  , _config = require(process.env.HOME+'/.nexus/config.js') // JSON.parse(process.env.NEXUS_CONFIG)
  , nexus = require('../nexus')
  , opts = { port : _config.port
           , host : _config.host }

process.title = 'nexus-server:'+_config.port
           
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
  var server = dnode(nexus(_config)).listen(opts)
  server.on('error',function(err){
    console.error(err)
  })
  server.on('ready',function(){
    console.log('started server')
  })
}
