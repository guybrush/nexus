#!/usr/bin/env node

var opti = require('optimist')
var argv = opti.argv
var nexus = require('../')
var readline = require('readline')
var dnode = require('dnode')
var fs = require('fs')
var async = require('async')
var path = require('path')
var _ = require('underscore')
var cp = require('child_process')
var nodeMinorVersion = parseInt(process.versions.node.split('.')[1])
var _pkg = require('../package.json')
var debug = require('debug')('nexus:cli')
var usage =
  [ ' ___  ___  _ _  _ _  ___'
  , '|   || -_||_\'_|| | ||_ -|'
  , '|_|_||___||_,_||___||___|v'+_pkg.version
  , ''
  , 'nexus [-r <remote>] [-c <path to configFile>] [<command> [<options>]]'
  , ''
  , 'commands:'
  , ''
  , '    version    .. print version-number'
  , '    config     .. print config'
  , '    ls         .. list installed packages'
  , '    install    .. install packages'
  , '    uninstall  .. uninstall packages'
  , '    ps         .. list of current running (and crashed) programs'
  , '    start      .. start a program'
  , '    restart    .. restart a running (or max crashed) program'
  , '    restartall .. restart all running programs'
  , '    reboot     .. reboot ghost-programs'
  , '    stop       .. stop a running program'
  , '    stopall    .. stop all running programs'
  , '    exec       .. execute a command'
  , '    log        .. access log-files'
  , '    server     .. control nexus-servers'
  , '    help       .. try `nexus help <command>` for more info'
  , ''
  ].join('\n')

// node@0.6.x compat
fs.exists = fs.exists || path.exists
fs.existsSync = fs.existsSync || path.existsSync
process.stdin.setRawMode = process.stdin.setRawMode || require('tty').setRawMode
    
if (!argv._[0]) return exit(null, usage)
else if (argv._[0] == 'help') {
  if (!argv._[1]) return exit(null, usage)
  help(argv._[1],exit)
}
else {
  var opts = {}
  if (argv.c) opts = require(argv.c)
  if (argv.p) opts.port = argv.p
  if (argv.h) opts.host = argv.h
  if (argv.key) opts.key = argv.key
  if (argv.cert) opts.cert = argv.cert
  if (argv.ca) opts.ca = argv.ca
  if (argv.r) opts.remote = argv.r
  if (argv.c)
    var N = nexus(opts)
  else
    var N = nexus()
  if (!opts.remote && !argv.p)
    return parseArgs('local')
  var client = N.connect(opts,function(remote,conn){
    N = remote
    parseArgs('remote')
  })
  client.on('error',exit)
}

function parseArgs(type) {
  var cmd = argv._[0]
  switch (cmd) {
    case 'version':
      exit(null,_pkg.version)
      break
    case 'config':
      N.config(exit)
      break
    case 'install':
      var opts = {}
      if (argv.type) opts.type = argv.type
      if (argv._[1]) opts.url = argv._[1]
      if (argv._[2]) opts.name = argv._[2]
      N.install(opts,exit)
      break
    case 'rm':
    case 'uninstall':
      argv._.shift()
      if (argv._.length == 0) return exit('invalid cli arguments')
      async.map(argv._, function(x, next){
        N.uninstall(x, next)
      }, exit)
      break
    case 'ls':
      var filter = parseFilter(process.argv.slice(process.argv.indexOf(cmd)+1))
      if (argv._[1]) {
        filter = filter || {}               
        filter.name = argv._[1]
      }
      N.ls(filter, exit)
      break
    case 'ps':
      var filter = parseFilter(process.argv.slice(process.argv.indexOf(cmd)+1))
      if (argv._[1]) {
        filter = filter || {}               
        filter.id = argv._[1]
      }
      N.ps(filter, exit)
      break
    case 'start':
      var opts = {}
      var idx = process.argv.indexOf('--')
      opts.name = argv._[1]
      if (!!~idx)
        opts.command = process.argv.slice(process.argv.indexOf('--')+1).join(' ')
      // exit(null,opts)
      N.start(opts, exit)
      break
    case 'restart': 
      argv._.shift()
      if (argv._.length == 0) return exit('invalid cli arguments')
      async.map(argv._, function(x, next){
        N.restart(x, next)
      }, exit)
      break
    case 'restartall':
      N.restartall(exit)
      break
    case 'reboot':
      N.reboot(exit)
      break
    case 'stop':
      argv._.shift()
      if (argv._.length == 0) return exit('invalid cli arguments')
      async.map(argv._, function(x, next){
        N.stop(x, next)
      }, exit)
      break
    case 'stopall':
      N.stopall(exit)
      break
    case 'log':
      argv._.shift()
      var opts = {}
      opts.id = argv._[0]
      if (argv.f) opts.follow = true
      if (argv.n) opts.lines = argv.n
      opts.stdout = function(d) {
        d.toString().split('\n').forEach(function(x){
          console.log(x)
        })
      }
      opts.kill = killCommand()
      N.log(opts, exit)
      break
    case 'exec':
      // nexus exec -- "node -e \"setInterval(function(){console.log('hello world')},500)\""
      var opts = {}

      execArgv = opti.parse(process.argv.slice( process.argv.indexOf(cmd)
                                              , process.argv.indexOf('--')) )
      opts.name = execArgv._[1]
      if (!!~process.argv.indexOf('--'))
        opts.command = process.argv.slice(process.argv.indexOf('--')+1)
      else
        return exit(new Error('invalid options, no command defined'))
      opts.stdout = function(d) {
        d.toString().split('\n').forEach(function(x){
          console.log('stdout','→',x)
        })
      }
      opts.stderr = function(d) {
        d.toString().split('\n').forEach(function(x){
          console.log('stderr','→',x)
        })
      }
      opts.stdin = function(stdin) {
        rl.on('line',function(data){stdin(data)})
      }
      opts.kill = killCommand()
      N.exec(opts, exit)
      break
    case 'server':
      var opts = {}
      if (argv._[1]) opts.command = argv._[1]
      if (opts.command == 'start') {
        if (argv.p) opts.port = argv.p
        if (argv.cert) opts.port = argv.cert
        if (argv.key) opts.key = argv.key
        if (argv.ca) opts.ca = argv.ca
      }
      else if (opts.command == 'stop' && argv._[2]) {
        if (!argv._[2]) return exit('nexus server stop <id>')
        opts.id = argv._[2]
      }  
      N.server(opts, exit)
      break
    default: exit('unknown command')
  }
}

function help(cmd,cb) {
  var docDir = path.join(__dirname,'..','doc','cli')
  var cmdFile = path.join(docDir,cmd+'.md')
  fs.exists(cmdFile,function(e){
    if (!e) return exit('invalid command "'+cmd+'"')
    fs.readFile(cmdFile,'utf-8',cb)
  })
}

function parseFilter(args) {
  var result = false
  var args = args.map(function(x){return x.replace(/\./,':')})
  args = opti.parse(args)
  delete args._
  delete args['$0']                         
  _.each(args,function(x,i){ 
    result = result || {}
    i = i.replace(/:/,'.')
    result[i] = x                                    
  })
  return result
}

function killCommand() {
  return function(killIt) {
    if (nodeMinorVersion >= 7) {
      var rl = readline.createInterface( { input  : process.stdin
                                         , output : process.stdout } )
      rl.on('SIGINT',function(){
        killIt(exit)
      })
    }
    else {                                       
      var stdin = process.openStdin()
      require('tty').setRawMode(true)
      stdin.on('keypress', function (chunk, key) {
        if (key && key.ctrl && key.name == 'c') {
          killIt(exit())
        }
      })
    }
  }
}

function exit(err, msg) {
  if (err) {
    if (err.message) err = err.message
    console.error('error:',err)
    return process.exit(1)
  }
  msg && console.log(msg)
  process.exit(0)
}

