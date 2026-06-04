import { SetMetadata } from "@nestjs/common";
import { SKIP_FIRST_ACCESS_KEY } from "./first-access.guard";

/** Marca um endpoint como acessível mesmo quando primeiroAcesso=true. */
export const SkipFirstAccessGuard = () => SetMetadata(SKIP_FIRST_ACCESS_KEY, true);
