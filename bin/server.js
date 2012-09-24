#!/usr/bin/env node

// -c <path to config>
// -p <port>
// --key <path to key>
// --cert <path to cert>
// --ca <path to ca>

process.title = 'nexus-server'

var opti = require('optimist')

var cfg
if (opti.argv.c) 
  cfg = opti.argv.c
else if (process.env.NEXUS_CONFIG)
  cfg = JSON.parse(process.env.NEXUS_CONFIG)

var nexus = require('../')(cfg)

var opts = {}
opts.port = opti.argv.p
opts.cert = opti.argv.cert
opts.key = opti.argv.key
opts.ca = opti.argv.ca

nexus.listen(opts,function(err,data){
  if (err) return console.error('error:',err)
  console.log(nexus._config)
  console.log(Object.keys(data))
})

