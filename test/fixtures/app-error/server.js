var port = process.argv[2] || 3002
  , i = 0
require('http').createServer(function(req,res){
  console.log('request '+ i++)
  res.end('hello - i will crash now.. see you later! (hopefully)')
  if (i >= 2) throw(new Error('i crashed hard'))
}).listen(port,function(){console.log('listening on :'+port)})
