import { Injectable, Controller, Get, Delete, Param, Req, Res, UseGuards, NotFoundException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Cron, CronExpression } from "@nestjs/schedule";
import { createHmac, randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { antesDeEfeito } from "./whatsapp-execucao";

const LIMITE = 5*1024*1024;
export function tokenMedia() {
  if (!process.env.JWT_SECRET) throw new Error("Chave do serviço indisponível");
  return createHmac("sha256",process.env.JWT_SECRET).update("orkiestri/media-worker/v1").digest("hex");
}
export function mimeAnexo(buffer: Buffer): string | null {
  if (buffer.subarray(0,5).toString()==="%PDF-") return "application/pdf";
  if (buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (buffer[0]===255 && buffer[1]===216 && buffer[2]===255) return "image/jpeg";
  if (buffer.subarray(0,4).toString()==="RIFF" && buffer.subarray(8,12).toString()==="WEBP") return "image/webp";
  return null;
}

@Injectable()
export class WhatsappMediaService {
  readonly raiz = process.env.WHATSAPP_DOCS_DIR || "/app/secure/whatsapp";
  constructor(private prisma: PrismaService,private wa: WhatsAppService) {}
  arquivo(id: string) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new NotFoundException();
    return path.join(this.raiz,id+".bin");
  }
  async tratar(data: any, user: {id:string;organizationId:string}, instancia: string, conversa: string, contexto: string): Promise<{ consumido: boolean; transcricao?: string }> {
    let message=data?.message;
    for(let n=0;n<3;n++) message=message?.ephemeralMessage?.message || message?.viewOnceMessage?.message || message?.viewOnceMessageV2?.message || message;
    const audio=message?.audioMessage, document=message?.documentMessage, image=message?.imageMessage;
    if(!audio&&!document&&!image)return {consumido:false};
    const say=(s:string)=>this.wa.sendToJid(conversa,s,instancia);
    if(contexto!=="PESSOAL") {await say("🏢 Para enviar áudio ou guardar um anexo pessoal, envie *pessoal*. Anexos de projetos podem ser enviados na tela do projeto.");return {consumido:true};}
    const metadata=audio||document||image;
    const tamanho=Number(metadata.fileLength?.low ?? metadata.fileLength ?? 0);
    if(tamanho>LIMITE || Number(audio?.seconds||0)>30){await say("Envie arquivo de até 5 MB ou áudio de até 30 segundos.");return {consumido:true};}
    const api=process.env.EVOLUTION_API_URL, key=process.env.EVOLUTION_API_KEY;
    if(!api||!key)throw new Error("Provedor de mídia indisponível");
    // Não acessa URL recebida pelo webhook: somente o provedor configurado.
    const response=await fetch(`${api.replace(/\/$/,"")}/chat/getBase64FromMediaMessage/${encodeURIComponent(instancia)}`,{
      method:"POST",headers:{"Content-Type":"application/json",apikey:key},body:JSON.stringify({message:{key:data.key,message},convertToMp4:false}),signal:AbortSignal.timeout(20000),redirect:"error",
    });
    if(!response.ok)throw new Error("Mídia indisponível");
    const chunks:Uint8Array[]=[];let bytes=0;
    if(!response.body)throw new Error("Mídia vazia");
    for await(const chunk of response.body as any){bytes+=chunk.length;if(bytes>8*1024*1024){await response.body.cancel().catch(()=>{});throw new Error("Mídia excede limite");}chunks.push(chunk);}
    const result=JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const base64=String(result.base64||"").replace(/^data:[^,]+,/,"");
    if(!base64||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw new Error("Mídia inválida");
    const buffer=Buffer.from(base64,"base64");
    if(!buffer.length||buffer.length>LIMITE){await say("O arquivo está vazio ou excede 5 MB.");return {consumido:true};}
    if(audio){
      const r=await fetch(`${process.env.MEDIA_WORKER_URL||"http://media-worker:8081"}/transcribe`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${tokenMedia()}`},body:JSON.stringify({base64,mime:result.mimetype||audio.mimetype||"audio/ogg"}),signal:AbortSignal.timeout(70000),redirect:"error"});
      if(!r.ok){await say(r.status===429?"A transcrição está ocupada. Envie por texto ou tente novamente em instantes.":"Não consegui transcrever este áudio. Envie fala de até 30 segundos ou escreva a mensagem.");return {consumido:true};}
      const transcrito:any=await r.json();
      const text=typeof transcrito.text==="string"?transcrito.text.trim():"";
      if(!text||text.length>1500)throw new Error("Transcrição inválida");
      return {consumido:false,transcricao:text};
    }
    const mime=mimeAnexo(buffer);
    if(!mime){await say("Aceito PDF e imagens JPEG, PNG ou WebP de até 5 MB.");return {consumido:true};}
    const id=randomUUID(),ext={"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[mime];
    const nome=String(document?.fileName||`imagem.${ext}`).replace(/[\r\n\x00-\x1f<>:"/\\|?*]/g,"_").slice(0,120);
    await antesDeEfeito();
    await fs.promises.mkdir(this.raiz,{recursive:true,mode:0o700});
    try{
      await this.prisma.$transaction(async tx=>{
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${user.id},271))::text`;
        const totals:any[]=await tx.$queryRaw`SELECT COALESCE(SUM(tamanho),0)::int AS total,COUNT(*)::int AS quantidade FROM whatsapp_anexos WHERE user_id=${user.id}`;
        if(totals[0].total+buffer.length>100*1024*1024 || totals[0].quantidade>=100)throw new Error("Cota de anexos atingida");
        await fs.promises.writeFile(this.arquivo(id),buffer,{mode:0o600,flag:"wx"});
        await tx.$executeRaw`INSERT INTO whatsapp_anexos(id,user_id,organization_id,nome,mime,tamanho) VALUES (${id},${user.id},${user.organizationId},${nome},${mime},${buffer.length})`;
      });
    }catch(e){await fs.promises.unlink(this.arquivo(id)).catch(()=>{});throw e;}
    const app=(process.env.APP_URL||"https://orkiestri.com").replace(/\/$/,"");
    await say(`📎 *Anexo pessoal guardado:* ${nome}\nDisponível por 30 dias, somente na sua conta:\n${app}/dashboard/whatsapp-anexos\nNenhum gasto ou compromisso foi criado a partir do arquivo.`);
    return {consumido:true};
  }
  @Cron(CronExpression.EVERY_DAY_AT_3AM,{timeZone:"America/Sao_Paulo"})
  async expirar(){
    const rows:any[]=await this.prisma.$queryRaw`DELETE FROM whatsapp_anexos WHERE expira_em<CURRENT_TIMESTAMP RETURNING id`;
    for(const row of rows)await fs.promises.unlink(this.arquivo(row.id)).catch(()=>{});
  }
}

@Controller("whatsapp-anexos")
@UseGuards(AuthGuard("jwt"))
export class WhatsappAnexosController {
  constructor(private prisma:PrismaService,private media:WhatsappMediaService){}
  @Get()
  listar(@Req() req:any){return this.prisma.$queryRaw`SELECT id,nome,mime,tamanho,criado_em,expira_em FROM whatsapp_anexos WHERE user_id=${req.user.id} AND organization_id=${req.user.organizationId} AND expira_em>CURRENT_TIMESTAMP ORDER BY criado_em DESC LIMIT 100`;}
  @Get(":id/download")
  async baixar(@Param("id") id:string,@Req() req:any,@Res() res:any){
    const rows:any[]=await this.prisma.$queryRaw`SELECT nome,mime FROM whatsapp_anexos WHERE id=${id} AND user_id=${req.user.id} AND organization_id=${req.user.organizationId} AND expira_em>CURRENT_TIMESTAMP`;
    if(!rows.length)throw new NotFoundException();
    await fs.promises.access(this.media.arquivo(id)).catch(()=>{throw new NotFoundException();});
    res.setHeader("Content-Type",rows[0].mime);res.setHeader("Content-Disposition",`attachment; filename*=UTF-8''${encodeURIComponent(rows[0].nome)}`);
    res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("Cache-Control","no-store");res.setHeader("Content-Security-Policy","sandbox");
    fs.createReadStream(this.media.arquivo(id)).on("error",()=>res.destroy()).pipe(res);
  }
  @Delete(":id")
  async excluir(@Param("id") id:string,@Req() req:any){
    const rows:any[]=await this.prisma.$queryRaw`DELETE FROM whatsapp_anexos WHERE id=${id} AND user_id=${req.user.id} AND organization_id=${req.user.organizationId} RETURNING id`;
    if(!rows.length)throw new NotFoundException();await fs.promises.unlink(this.media.arquivo(id)).catch(()=>{});return {excluido:true};
  }
}
