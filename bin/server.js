#!/usr/bin/env node

var nexus = require('../index')
  , dnode = require('dnode')
  , config = nexus.config()
  
dnode(nexus).listen(config.port,function(){
  console.log(':'+config.port)
})
