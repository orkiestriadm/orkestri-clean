const http=require('node:http'),fs=require('node:fs'),{randomUUID}=require('node:crypto');
global.__whatsappFixtureMessages=[];
http.createServer(async(req,res)=>{
 try {
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const data=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{};
  res.setHeader('Content-Type','application/json');
  if(req.url==='/test/messages')return res.end(JSON.stringify(global.__whatsappFixtureMessages));
  if(req.url.startsWith('/chat/getBase64FromMediaMessage/')){
    const audio=!!data.message?.message?.audioMessage;
    const file=audio?fs.readFileSync('/tests/fixtures/portuguese.wav'):Buffer.from('%PDF-1.4\nprivate test document\n%%EOF');
    return res.end(JSON.stringify({base64:file.toString('base64'),mimetype:audio?'audio/wav':'application/pdf'}));
  }
  if(req.url.includes('/message/send')){global.__whatsappFixtureMessages.push(data);return res.end(JSON.stringify({key:{id:randomUUID()}}));}
  res.end(JSON.stringify({instance:{state:'open'},state:'open',connected:true}));
 }catch{res.statusCode=400;res.end('{}');}
}).listen(18080,'127.0.0.1');
