#!/usr/bin/env node

process.title = 'nexus-server'

var nexus = require('../')
  , _config = nexus.config()
  , dnode = require('dnode')

var server = dnode(nexus()).listen(_config.port)
  