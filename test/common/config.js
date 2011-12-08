module.exports = 
{ port : Math.floor(Math.random() * 40000 + 10000) 
, host : '0.0.0.0'
, key : __dirname+'/agent2-key.pem'
, cert : __dirname+'/agent2-cert.pem'
// , key : __dirname+'/bhub.key'
// , cert : __dirname+'/bhub.cert'
, ca : __dirname+'/ca'
, prefix : __dirname+'/root'
}