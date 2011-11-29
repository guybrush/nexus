var port = process.argv[2] || Math.floor(Math.random() * 40000 + 10000)
require('http').createServer(function(req,res){
  console.log('incomming request')
  res.end('hello - i will crash now.. see you later! (hopefully)')
  if (req.url!='/favicon.ico') throw(new Error('i crashed hard'))
}).listen(port,function(){console.log('listening on :'+port)})

