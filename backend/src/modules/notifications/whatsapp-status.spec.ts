import { WhatsAppService } from "./whatsapp.service";

describe("WhatsApp compartilhado — status da organização", () => {
  it("consulta a instância de envio quando não há cadastro por organização", async () => {
    const prisma = { orgWhatsappConfig: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new WhatsAppService({ get: (_key: string, fallback: any) => fallback } as any, prisma as any);
    jest.spyOn(service, "resolveInstance").mockResolvedValue("orkestri-default");
    const status = jest.spyOn(service, "getStatus").mockResolvedValue({ connected: true, status: "open" });
    expect(await service.getOrgStatus("org")).toEqual({ connected: true, status: "open" });
    expect(status).toHaveBeenCalledWith("orkestri-default");
  });

  it("informa desconexão real da instância compartilhada", async () => {
    const prisma = { orgWhatsappConfig: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new WhatsAppService({ get: (_key: string, fallback: any) => fallback } as any, prisma as any);
    jest.spyOn(service, "getStatus").mockResolvedValue({ connected: false, status: "close" });
    expect(await service.getOrgStatus("org")).toEqual({ connected: false, status: "close" });
  });
});
